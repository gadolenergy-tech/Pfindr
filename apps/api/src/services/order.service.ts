import crypto from "crypto";
import type { OrderStatus, Prisma } from "@prisma/client";
import type { CreateOrderInput } from "@finder/shared";
import { prisma } from "../lib/prisma";
import { badRequest, conflict, notFound } from "../lib/errors";
import { decimalToNumber, toIso } from "../lib/serialize";
import { deriveStatus } from "./inventory.service";

export const orderInclude = {
  customer: { select: { id: true, fullName: true, email: true, phone: true, company: true } },
  items: true,
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function serializeOrder(order: OrderRow) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    subtotal: decimalToNumber(order.subtotal),
    total: decimalToNumber(order.total),
    currency: order.currency,
    note: order.note,
    placedAt: order.placedAt.toISOString(),
    fulfilledAt: toIso(order.fulfilledAt),
    cancelledAt: toIso(order.cancelledAt),
    source: order.source,
    paidAt: toIso(order.paidAt),
    paymentReference: order.paymentReference,
    fulfilment: order.fulfilment,
    deliveryAddress: order.deliveryAddress,
    buyerPhone: order.buyerPhone,
    customer: order.customer,
    items: order.items.map((item) => ({
      id: item.id,
      inventoryItemId: item.inventoryItemId,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: decimalToNumber(item.unitPrice),
      lineTotal: decimalToNumber(item.lineTotal),
    })),
  };
}

/** ORD-260921-7F3A — date for humans, random suffix for uniqueness. */
export function newOrderNumber(): string {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return `ORD-${date}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

/**
 * Allowed moves. Terminal states (FULFILLED, CANCELLED, REFUNDED) only move to
 * REFUNDED from FULFILLED, so stock and customer totals are adjusted exactly
 * once per order.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "PROCESSING", "FULFILLED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "FULFILLED", "CANCELLED"],
  PROCESSING: ["FULFILLED", "CANCELLED"],
  FULFILLED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

/** Stock and customer totals move together, inside one transaction. */
async function adjustStock(
  tx: Prisma.TransactionClient,
  lines: { inventoryItemId: string | null; quantity: number }[],
  direction: 1 | -1,
): Promise<void> {
  for (const line of lines) {
    if (!line.inventoryItemId) continue; // the listing was deleted since
    const item = await tx.inventoryItem.findUnique({
      where: { id: line.inventoryItemId },
      select: { id: true, quantity: true, lowStockThreshold: true, status: true },
    });
    if (!item) continue;
    const quantity = item.quantity + direction * line.quantity;
    await tx.inventoryItem.update({
      where: { id: item.id },
      data: {
        quantity,
        status: deriveStatus(quantity, item.lowStockThreshold, item.status),
      },
    });
  }
}

export async function createOrder(vendorId: string, input: CreateOrderInput) {
  // Collapse duplicate lines so one item cannot slip past the stock check twice.
  const merged = new Map<string, { quantity: number; unitPrice?: number }>();
  for (const line of input.items) {
    const prev = merged.get(line.inventoryItemId);
    merged.set(line.inventoryItemId, {
      quantity: (prev?.quantity ?? 0) + line.quantity,
      unitPrice: line.unitPrice ?? prev?.unitPrice,
    });
  }

  return prisma.$transaction(async (tx) => {
    const stock = await tx.inventoryItem.findMany({
      where: { id: { in: [...merged.keys()] }, vendorId },
    });
    if (stock.length !== merged.size) {
      throw badRequest("One or more items are not in your inventory");
    }

    const lines = stock.map((item) => {
      const want = merged.get(item.id)!;
      if (item.status === "DISCONTINUED") {
        throw conflict(`${item.name} is discontinued`);
      }
      if (item.quantity < want.quantity) {
        throw conflict(`Only ${item.quantity} ${item.unit} of ${item.name} in stock`);
      }
      const unitPrice = want.unitPrice ?? decimalToNumber(item.price);
      return {
        inventoryItemId: item.id,
        name: item.name,
        sku: item.sku,
        quantity: want.quantity,
        unitPrice,
        lineTotal: Math.round(unitPrice * want.quantity * 100) / 100,
      };
    });

    let customerId = input.customerId ?? null;
    if (customerId) {
      const owned = await tx.customer.findFirst({
        where: { id: customerId, vendorId },
        select: { id: true },
      });
      if (!owned) throw notFound("No such customer");
    } else if (input.customer) {
      const created = await tx.customer.create({
        data: {
          vendorId,
          fullName: input.customer.fullName,
          email: input.customer.email?.toLowerCase() ?? null,
          phone: input.customer.phone ?? null,
          company: input.customer.company ?? null,
          notes: input.customer.notes ?? null,
        },
      });
      customerId = created.id;
    }

    const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

    const order = await tx.order.create({
      data: {
        orderNumber: newOrderNumber(),
        vendorId,
        customerId,
        subtotal,
        total: subtotal,
        currency: stock[0]?.currency ?? "NGN",
        note: input.note ?? null,
        items: { create: lines },
      },
      include: orderInclude,
    });

    await adjustStock(tx, lines, -1);

    if (customerId) {
      await tx.customer.update({
        where: { id: customerId },
        data: { totalOrders: { increment: 1 }, totalSpent: { increment: subtotal } },
      });
    }

    return order;
  });
}

export async function transitionOrder(
  vendorId: string,
  orderId: string,
  next: OrderStatus,
  note?: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, vendorId },
      include: { items: true },
    });
    if (!order) throw notFound("No such order");
    if (order.status === next) return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
    if (!TRANSITIONS[order.status].includes(next)) {
      throw conflict(`An order that is ${order.status.toLowerCase()} cannot become ${next.toLowerCase()}`);
    }

    // Cancelling or refunding puts the goods back and reverses the customer totals.
    if (next === "CANCELLED" || next === "REFUNDED") {
      await adjustStock(tx, order.items, 1);
      if (order.customerId) {
        await tx.customer.update({
          where: { id: order.customerId },
          data: {
            totalOrders: { decrement: 1 },
            totalSpent: { decrement: decimalToNumber(order.total) },
          },
        });
      }
    }

    return tx.order.update({
      where: { id: order.id },
      data: {
        status: next,
        ...(note ? { note } : {}),
        ...(next === "FULFILLED" ? { fulfilledAt: new Date() } : {}),
        ...(next === "CANCELLED" ? { cancelledAt: new Date() } : {}),
      },
      include: orderInclude,
    });
  });
}
