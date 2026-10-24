import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import type { CreateCheckoutInput, Purchase } from "@finder/shared";
import { env } from "../env";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { decimalToNumber, toIso } from "../lib/serialize";
import { initializeTransaction, toSubunit, verifyTransaction } from "../lib/paystack";
import { deriveStatus } from "./inventory.service";
import { readPreferences } from "./preferences.service";
import { formatOrderMessage } from "./checkout.messages";
import { newOrderNumber } from "./order.service";

/** Currencies Paystack can charge in. */
const PAYABLE_CURRENCIES = new Set(["NGN", "GHS", "ZAR", "KES", "USD"]);

const purchaseInclude = {
  vendor: { select: { id: true, businessName: true, city: true } },
  lines: { orderBy: { id: "asc" } },
  order: { select: { orderNumber: true, status: true, paidAt: true } },
} satisfies Prisma.CheckoutSessionInclude;

type SessionRow = Prisma.CheckoutSessionGetPayload<{ include: typeof purchaseInclude }>;

export function serializePurchase(s: SessionRow): Purchase {
  return {
    reference: s.reference,
    status: s.status,
    items: s.lines.map((l) => ({
      inventoryItemId: l.inventoryItemId,
      name: l.name,
      brand: l.brand,
      imageUrl: l.imageUrl,
      quantity: l.quantity,
      unitPrice: decimalToNumber(l.unitPrice),
      lineTotal: decimalToNumber(l.lineTotal),
    })),
    total: decimalToNumber(s.total),
    currency: s.currency,
    fulfilment: s.fulfilment,
    deliveryAddress: s.deliveryAddress,
    createdAt: s.createdAt.toISOString(),
    vendor: s.vendor,
    order: s.order
      ? { orderNumber: s.order.orderNumber, status: s.order.status, paidAt: toIso(s.order.paidAt) }
      : null,
  };
}

/**
 * Takes `quantity` off the shelf only if that much is there. The conditional
 * update is atomic, so two buyers racing for the last unit cannot both win.
 */
async function reserveStock(tx: Prisma.TransactionClient, itemId: string, quantity: number): Promise<boolean> {
  const { count } = await tx.inventoryItem.updateMany({
    where: { id: itemId, quantity: { gte: quantity } },
    data: { quantity: { decrement: quantity } },
  });
  if (count === 0) return false;
  await syncStatus(tx, itemId);
  return true;
}

async function releaseStock(tx: Prisma.TransactionClient, itemId: string | null, quantity: number) {
  if (!itemId) return; // listing deleted since
  const { count } = await tx.inventoryItem.updateMany({
    where: { id: itemId },
    data: { quantity: { increment: quantity } },
  });
  if (count) await syncStatus(tx, itemId);
}

async function syncStatus(tx: Prisma.TransactionClient, itemId: string) {
  const item = await tx.inventoryItem.findUniqueOrThrow({
    where: { id: itemId },
    select: { quantity: true, lowStockThreshold: true, status: true },
  });
  await tx.inventoryItem.update({
    where: { id: itemId },
    data: { status: deriveStatus(item.quantity, item.lowStockThreshold, item.status) },
  });
}

/**
 * Where Paystack sends the buyer back to. The request's Origin is used when it
 * is one of ours, so the same API serves localhost and a demo tunnel; anything
 * else falls back to WEB_URL rather than becoming an open redirect.
 */
export function returnOrigin(origin: string | undefined): string {
  const fallback = new URL(env.webUrl).origin;
  if (!origin) return fallback;
  const allowed =
    origin === fallback ||
    env.corsOrigins.includes(origin) ||
    (!env.isProduction && /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin));
  return allowed ? origin : fallback;
}

/**
 * Starts a payment for one vendor's share of a cart: holds the stock for every
 * line, freezes what the buyer saw (name, brand, photo, price) onto the session
 * and hands back Paystack's payment page.
 */
export async function startCheckout(
  buyer: { userId: string; email: string; vendorId: string | null },
  input: CreateCheckoutInput,
  origin: string,
) {
  await expireStaleCheckouts();

  // The same product twice in a cart is one line.
  const wanted = new Map<string, number>();
  for (const { inventoryItemId, quantity } of input.items) {
    wanted.set(inventoryItemId, (wanted.get(inventoryItemId) ?? 0) + quantity);
  }

  const found = await prisma.inventoryItem.findMany({
    where: { id: { in: [...wanted.keys()] } },
    include: { vendor: { select: { id: true, status: true, listingPaused: true, preferences: true } } },
  });
  if (found.length !== wanted.size) throw notFound("A product in your cart is no longer available");

  const first = found[0]!;
  if (found.some((i) => i.vendorId !== first.vendorId)) {
    throw badRequest("Pay for one vendor at a time. Remove the other vendors' products, or pay for them separately.");
  }
  if (found.some((i) => i.currency !== first.currency)) {
    throw badRequest("These products are priced in different currencies. Pay for them separately.");
  }

  for (const item of found) {
    if (item.vendor.status !== "VERIFIED" || item.vendor.listingPaused) {
      throw notFound(`${item.name} is no longer available`);
    }
    if (buyer.vendorId === item.vendorId) throw badRequest("You cannot buy from your own business");
    if (item.status === "DISCONTINUED") throw conflict(`${item.name} has been discontinued`);

    // A hidden or zero price means "ask the vendor" — there is nothing to charge.
    if (decimalToNumber(item.price) <= 0 || !readPreferences(item.vendor.preferences).privacy.showPricing) {
      throw conflict(`${item.name}: this vendor quotes on request. Message them to buy.`);
    }
    if (!PAYABLE_CURRENCIES.has(item.currency)) {
      throw conflict(`Online payment in ${item.currency} is not supported. Message the vendor to buy.`);
    }
  }

  const lines = found.map((item) => {
    const quantity = wanted.get(item.id)!;
    const unitPrice = decimalToNumber(item.price);
    return { item, quantity, unitPrice, lineTotal: Math.round(unitPrice * quantity * 100) / 100 };
  });
  const total = Math.round(lines.reduce((sum, l) => sum + l.lineTotal, 0) * 100) / 100;
  const vendorId = first.vendorId;
  const currency = first.currency;
  const reference = `FND-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  const expiresAt = new Date(Date.now() + env.checkoutHoldMinutes * 60_000);

  // All or nothing: one product short rolls back every hold already taken.
  const session = await prisma.$transaction(async (tx) => {
    for (const { item, quantity } of lines) {
      if (!(await reserveStock(tx, item.id, quantity))) {
        const left = (await tx.inventoryItem.findUnique({ where: { id: item.id }, select: { quantity: true } }))?.quantity ?? 0;
        throw conflict(
          left > 0 ? `Only ${left} ${item.unit} of ${item.name} left in stock` : `${item.name} just sold out`,
        );
      }
    }
    return tx.checkoutSession.create({
      data: {
        reference,
        userId: buyer.userId,
        vendorId,
        total,
        currency,
        fulfilment: input.fulfilment,
        deliveryAddress: input.fulfilment === "DELIVERY" ? input.deliveryAddress ?? null : null,
        buyerPhone: input.buyerPhone,
        expiresAt,
        // The photo, brand and price frozen here are what the buyer agreed to.
        lines: {
          create: lines.map(({ item, quantity, unitPrice, lineTotal }) => ({
            inventoryItemId: item.id,
            name: item.name,
            sku: item.sku,
            brand: item.brand,
            imageUrl: item.imageUrl,
            quantity,
            unitPrice,
            lineTotal,
          })),
        },
      },
      include: { lines: true },
    });
  });

  try {
    const payment = await initializeTransaction({
      email: buyer.email,
      amount: total,
      currency,
      reference,
      callbackUrl: `${origin}/checkout/complete`,
      metadata: { checkoutSessionId: session.id, vendorId, items: lines.length },
    });
    return { reference, authorizationUrl: payment.authorization_url, expiresAt: expiresAt.toISOString() };
  } catch (err) {
    // Payment never started — put the stock straight back.
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.checkoutSession.updateMany({
        where: { id: session.id, status: "PENDING" },
        data: { status: "FAILED" },
      });
      if (count) for (const line of session.lines) await releaseStock(tx, line.inventoryItemId, line.quantity);
    });
    throw err;
  }
}

/**
 * Asks Paystack whether the buyer paid and, the first time it hears yes,
 * turns the session into a real Order. Safe to call any number of times from
 * the return page and the webhook — only one caller wins the PENDING → PAID
 * update, and the rest just read the result.
 */
export async function confirmCheckout(reference: string) {
  const session = await prisma.checkoutSession.findUnique({ where: { reference }, include: { lines: true } });
  if (!session) throw notFound("No such checkout");
  if (session.status === "PAID" || session.status === "FAILED") return session;

  const payment = await verifyTransaction(reference);
  if (payment.status !== "success") return session; // still on Paystack, or abandoned

  if (payment.amount !== toSubunit(decimalToNumber(session.total)) || payment.currency !== session.currency) {
    logger.error(
      `checkout ${reference}: paid ${payment.amount} ${payment.currency}, expected ${toSubunit(decimalToNumber(session.total))} ${session.currency}`,
    );
    throw conflict("The payment amount did not match this order. Contact support with your reference.");
  }

  const paidAt = payment.paid_at ? new Date(payment.paid_at) : new Date();

  const order = await prisma.$transaction(async (tx) => {
    const { count } = await tx.checkoutSession.updateMany({
      where: { id: session.id, status: { in: ["PENDING", "EXPIRED"] } },
      data: { status: "PAID" },
    });
    if (count === 0) return null; // another caller already confirmed it

    // Paid after the hold lapsed: the stock went back on the shelf, so take it
    // again. If any of it has gone, the vendor still needs to know they were paid.
    let note: string | null = null;
    if (session.status === "EXPIRED") {
      const short: string[] = [];
      for (const line of session.lines) {
        if (!line.inventoryItemId) continue;
        if (!(await reserveStock(tx, line.inventoryItemId, line.quantity))) short.push(line.name);
      }
      if (short.length) {
        note = `Paid after the stock hold expired, and there is not enough stock left for ${short.join(", ")}. Fulfil it or refund the buyer.`;
        logger.warn(`checkout ${reference}: paid after expiry with insufficient stock`);
      }
    }

    const buyer = await tx.user.findUniqueOrThrow({
      where: { id: session.userId },
      select: { fullName: true, email: true },
    });
    const total = decimalToNumber(session.total);

    const existing = await tx.customer.findFirst({
      where: { vendorId: session.vendorId, userId: session.userId },
      select: { id: true },
    });
    const customer = existing
      ? await tx.customer.update({
          where: { id: existing.id },
          data: { totalOrders: { increment: 1 }, totalSpent: { increment: total }, phone: session.buyerPhone },
        })
      : await tx.customer.create({
          data: {
            vendorId: session.vendorId,
            userId: session.userId,
            fullName: buyer.fullName,
            email: buyer.email,
            phone: session.buyerPhone,
            totalOrders: 1,
            totalSpent: total,
          },
        });

    const created = await tx.order.create({
      data: {
        orderNumber: newOrderNumber(),
        vendorId: session.vendorId,
        customerId: customer.id,
        userId: session.userId,
        subtotal: total,
        total,
        currency: session.currency,
        note,
        source: "CHECKOUT",
        paymentReference: reference,
        paidAt,
        fulfilment: session.fulfilment,
        deliveryAddress: session.deliveryAddress,
        buyerPhone: session.buyerPhone,
        items: {
          create: session.lines.map((line) => ({
            inventoryItemId: line.inventoryItemId,
            name: line.name,
            sku: line.sku,
            brand: line.brand,
            imageUrl: line.imageUrl,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
          })),
        },
      },
    });

    await tx.checkoutSession.update({ where: { id: session.id }, data: { orderId: created.id } });

    // Lands in the vendor's inbox, threaded with the buyer, so they can
    // arrange pickup or delivery straight away.
    const subject = `Order ${created.orderNumber}`;
    await tx.conversation.create({
      data: {
        vendorId: session.vendorId,
        userId: session.userId,
        subject,
        lastMessageAt: new Date(),
        vendorUnread: 1,
        messages: {
          create: {
            senderType: "USER",
            senderId: session.userId,
            body: formatOrderMessage({
              ...session,
              orderNumber: created.orderNumber,
              total,
              lines: session.lines.map((l) => ({ name: l.name, brand: l.brand, quantity: l.quantity })),
            }),
          },
        },
      },
    });

    return created;
  });

  if (order) logger.info(`checkout ${reference}: paid → ${order.orderNumber}`);
  return prisma.checkoutSession.findUniqueOrThrow({ where: { reference } });
}

/** Releases stock held by checkouts nobody paid for. */
export async function expireStaleCheckouts() {
  const stale = await prisma.checkoutSession.findMany({
    where: { status: "PENDING", expiresAt: { lt: new Date() } },
    select: { id: true, lines: { select: { inventoryItemId: true, quantity: true } } },
    take: 200,
  });
  for (const s of stale) {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.checkoutSession.updateMany({
        where: { id: s.id, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
      if (count) for (const line of s.lines) await releaseStock(tx, line.inventoryItemId, line.quantity);
    });
  }
  return stale.length;
}

export async function getPurchase(userId: string, reference: string) {
  const session = await prisma.checkoutSession.findUnique({ where: { reference }, include: purchaseInclude });
  if (!session) throw notFound("No such checkout");
  if (session.userId !== userId) throw forbidden();
  return session;
}

export async function listPurchases(userId: string) {
  return prisma.checkoutSession.findMany({
    where: { userId, status: { not: "FAILED" } },
    include: purchaseInclude,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export { purchaseInclude };
