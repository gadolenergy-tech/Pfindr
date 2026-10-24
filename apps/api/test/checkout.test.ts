import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/paystack", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/paystack")>()),
  initializeTransaction: vi.fn(),
  verifyTransaction: vi.fn(),
}));

import { prisma } from "../src/lib/prisma";
import { initializeTransaction, verifyTransaction } from "../src/lib/paystack";
import {
  confirmCheckout,
  expireStaleCheckouts,
  returnOrigin,
  startCheckout,
} from "../src/services/checkout.service";
import { checkoutInput, makeItem, makeUser, makeVendor, resetDb } from "./factories";

const init = vi.mocked(initializeTransaction);
const verify = vi.mocked(verifyTransaction);

const buyerOf = (u: { id: string; email: string }) => ({ userId: u.id, email: u.email, vendorId: null });
const ORIGIN = "http://localhost:3020";

/** What Paystack reports for a successful charge of `total` naira. */
const paid = (reference: string, total: number, currency = "NGN") => ({
  status: "success",
  reference,
  amount: total * 100,
  currency,
  paid_at: new Date().toISOString(),
});

async function setup(itemOverrides: Parameters<typeof makeItem>[1] = {}) {
  const vendor = await makeVendor();
  const item = await makeItem(vendor.id, itemOverrides);
  const buyer = await makeUser();
  return { vendor, item, buyer };
}

beforeEach(async () => {
  await resetDb();
  init.mockReset().mockResolvedValue({
    authorization_url: "https://checkout.paystack.test/abc",
    access_code: "abc",
    reference: "ignored",
  });
  verify.mockReset();
});

describe("startCheckout", () => {
  it("holds the stock and records a pending session", async () => {
    const { item, buyer } = await setup({ quantity: 10, price: 5000 });

    const started = await startCheckout(buyerOf(buyer), checkoutInput(item.id, 3), ORIGIN);

    expect(started.authorizationUrl).toBe("https://checkout.paystack.test/abc");
    const session = await prisma.checkoutSession.findUniqueOrThrow({ where: { reference: started.reference } });
    expect(session.status).toBe("PENDING");
    expect(Number(session.total)).toBe(15000);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).quantity).toBe(7);
    // Paystack was asked for the right amount, in the buyer's own return URL.
    expect(init.mock.calls[0]![0]).toMatchObject({ amount: 15000, currency: "NGN", callbackUrl: `${ORIGIN}/checkout/complete` });
  });

  it("refuses more than is in stock and leaves the shelf untouched", async () => {
    const { item, buyer } = await setup({ quantity: 2 });

    await expect(startCheckout(buyerOf(buyer), checkoutInput(item.id, 3), ORIGIN)).rejects.toMatchObject({ status: 409 });

    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).quantity).toBe(2);
    expect(await prisma.checkoutSession.count()).toBe(0);
  });

  it("lets only one of two simultaneous buyers take the last unit", async () => {
    const { item } = await setup({ quantity: 1 });
    const [a, b] = [await makeUser(), await makeUser()];

    const results = await Promise.allSettled([
      startCheckout(buyerOf(a), checkoutInput(item.id), ORIGIN),
      startCheckout(buyerOf(b), checkoutInput(item.id), ORIGIN),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    const after = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.quantity).toBe(0);
    expect(after.status).toBe("OUT_OF_STOCK");
  });

  it("marks stock low when a purchase takes it under the threshold", async () => {
    const { item, buyer } = await setup({ quantity: 5, lowStockThreshold: 2 });
    await startCheckout(buyerOf(buyer), checkoutInput(item.id, 3), ORIGIN);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("LOW_STOCK");
  });

  it("rejects products that cannot be bought online", async () => {
    const buyer = await makeUser();
    const paused = await makeVendor({ listingPaused: true });
    const pending = await makeVendor({ status: "PENDING" });
    const quote = await makeVendor();

    await expect(
      startCheckout(buyerOf(buyer), checkoutInput((await makeItem(paused.id)).id), ORIGIN),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      startCheckout(buyerOf(buyer), checkoutInput((await makeItem(pending.id)).id), ORIGIN),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      startCheckout(buyerOf(buyer), checkoutInput((await makeItem(quote.id, { price: 0 })).id), ORIGIN),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      startCheckout(buyerOf(buyer), checkoutInput((await makeItem(quote.id, { currency: "EUR" })).id), ORIGIN),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("will not let a vendor buy from their own business", async () => {
    const { vendor, item } = await setup();
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: vendor.userId } });
    await expect(
      startCheckout({ userId: owner.id, email: owner.email, vendorId: vendor.id }, checkoutInput(item.id), ORIGIN),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("puts the stock back if Paystack cannot start the payment", async () => {
    const { item, buyer } = await setup({ quantity: 4 });
    init.mockRejectedValueOnce(new Error("paystack down"));

    await expect(startCheckout(buyerOf(buyer), checkoutInput(item.id, 2), ORIGIN)).rejects.toThrow("paystack down");

    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).quantity).toBe(4);
    expect((await prisma.checkoutSession.findFirstOrThrow()).status).toBe("FAILED");
  });
});

describe("startCheckout with a cart", () => {
  const cart = (items: { id: string; quantity: number }[]) => ({
    items: items.map((i) => ({ inventoryItemId: i.id, quantity: i.quantity })),
    fulfilment: "PICKUP" as const,
    buyerPhone: "+2348011111111",
  });

  it("holds every line, totals them, and freezes the brand and photo the buyer saw", async () => {
    const vendor = await makeVendor();
    const a = await makeItem(vendor.id, { name: "Paracetamol", brand: "Emzor", price: 100, quantity: 10, imageUrl: "https://cdn.test/a.png" });
    const b = await makeItem(vendor.id, { name: "Paracetamol", brand: "Fidson", price: 120, quantity: 10 });
    const buyer = await makeUser();

    const { reference } = await startCheckout(buyerOf(buyer), cart([{ id: a.id, quantity: 2 }, { id: b.id, quantity: 3 }]), ORIGIN);

    const session = await prisma.checkoutSession.findUniqueOrThrow({ where: { reference }, include: { lines: true } });
    expect(Number(session.total)).toBe(560);
    expect(session.lines.map((l) => [l.brand, l.quantity]).sort()).toEqual([["Emzor", 2], ["Fidson", 3]]);
    expect(session.lines.find((l) => l.brand === "Emzor")?.imageUrl).toBe("https://cdn.test/a.png");
    expect(init.mock.calls[0]![0]).toMatchObject({ amount: 560 });
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: a.id } })).quantity).toBe(8);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: b.id } })).quantity).toBe(7);
  });

  it("merges the same product listed twice into one line", async () => {
    const { item, buyer } = await setup({ quantity: 10 });
    const { reference } = await startCheckout(buyerOf(buyer), cart([{ id: item.id, quantity: 1 }, { id: item.id, quantity: 2 }]), ORIGIN);
    const lines = await prisma.checkoutLine.findMany({ where: { session: { reference } } });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.quantity).toBe(3);
  });

  it("rolls back every hold when one line is short", async () => {
    const vendor = await makeVendor();
    const plenty = await makeItem(vendor.id, { quantity: 10 });
    const scarce = await makeItem(vendor.id, { quantity: 1 });
    const buyer = await makeUser();

    await expect(
      startCheckout(buyerOf(buyer), cart([{ id: plenty.id, quantity: 4 }, { id: scarce.id, quantity: 2 }]), ORIGIN),
    ).rejects.toMatchObject({ status: 409 });

    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: plenty.id } })).quantity).toBe(10);
    expect(await prisma.checkoutSession.count()).toBe(0);
  });

  it("refuses a cart that spans two vendors", async () => {
    const [a, b] = [await setup(), await setup()];
    await expect(
      startCheckout(buyerOf(a.buyer), cart([{ id: a.item.id, quantity: 1 }, { id: b.item.id, quantity: 1 }]), ORIGIN),
    ).rejects.toMatchObject({ status: 400 });
    expect(await prisma.checkoutSession.count()).toBe(0);
  });

  it("puts every line on the paid order, with the brand and photo as sold", async () => {
    const vendor = await makeVendor();
    const a = await makeItem(vendor.id, { brand: "Emzor", price: 100, imageUrl: "https://cdn.test/a.png" });
    const b = await makeItem(vendor.id, { brand: "Fidson", price: 200 });
    const buyer = await makeUser();
    const { reference } = await startCheckout(buyerOf(buyer), cart([{ id: a.id, quantity: 1 }, { id: b.id, quantity: 2 }]), ORIGIN);
    verify.mockResolvedValue(paid(reference, 500));

    await confirmCheckout(reference);
    // The vendor repricing afterwards must not change what was sold.
    await prisma.inventoryItem.update({ where: { id: a.id }, data: { price: 999, imageUrl: null } });

    const order = await prisma.order.findFirstOrThrow({ include: { items: true } });
    expect(order.items).toHaveLength(2);
    const emzor = order.items.find((i) => i.brand === "Emzor")!;
    expect(Number(emzor.unitPrice)).toBe(100);
    expect(emzor.imageUrl).toBe("https://cdn.test/a.png");
    const message = await prisma.message.findFirstOrThrow();
    expect(message.body).toContain("1 × Cement 50kg (Emzor)");
    expect(message.body).toContain("2 × Cement 50kg (Fidson)");
  });

  it("releases every line when the hold expires", async () => {
    const vendor = await makeVendor();
    const a = await makeItem(vendor.id, { quantity: 5 });
    const b = await makeItem(vendor.id, { quantity: 5 });
    const buyer = await makeUser();
    const { reference } = await startCheckout(buyerOf(buyer), cart([{ id: a.id, quantity: 2 }, { id: b.id, quantity: 3 }]), ORIGIN);
    await prisma.checkoutSession.update({ where: { reference }, data: { expiresAt: new Date(Date.now() - 1000) } });

    await expireStaleCheckouts();

    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: a.id } })).quantity).toBe(5);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: b.id } })).quantity).toBe(5);
  });
});

describe("confirmCheckout", () => {
  async function pendingCheckout(quantity = 2) {
    const { vendor, item, buyer } = await setup({ quantity: 10, price: 5000 });
    const { reference } = await startCheckout(buyerOf(buyer), checkoutInput(item.id, quantity), ORIGIN);
    return { vendor, item, buyer, reference, total: 5000 * quantity };
  }

  it("turns a paid session into an order, a customer and a vendor message", async () => {
    const { vendor, buyer, reference, total } = await pendingCheckout(2);
    verify.mockResolvedValue(paid(reference, total));

    const session = await confirmCheckout(reference);

    expect(session.status).toBe("PAID");
    const order = await prisma.order.findFirstOrThrow({ include: { items: true } });
    expect(order).toMatchObject({ vendorId: vendor.id, userId: buyer.id, paymentReference: reference, source: "CHECKOUT" });
    expect(Number(order.total)).toBe(total);
    expect(order.items).toHaveLength(1);
    expect((await prisma.customer.findFirstOrThrow()).totalOrders).toBe(1);
    expect(await prisma.conversation.count({ where: { vendorId: vendor.id, vendorUnread: 1 } })).toBe(1);
  });

  it("creates exactly one order when the return page and webhook confirm together", async () => {
    const { reference, total } = await pendingCheckout();
    verify.mockResolvedValue(paid(reference, total));

    await Promise.all([confirmCheckout(reference), confirmCheckout(reference), confirmCheckout(reference)]);
    await confirmCheckout(reference); // a late webhook retry

    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.conversation.count()).toBe(1);
    expect((await prisma.customer.findFirstOrThrow()).totalOrders).toBe(1);
  });

  it("does not take the stock a second time on confirmation", async () => {
    const { item, reference, total } = await pendingCheckout(2);
    verify.mockResolvedValue(paid(reference, total));
    await confirmCheckout(reference);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).quantity).toBe(8);
  });

  it("rejects a payment whose amount or currency does not match", async () => {
    const { reference, total } = await pendingCheckout();

    verify.mockResolvedValue(paid(reference, total - 1));
    await expect(confirmCheckout(reference)).rejects.toMatchObject({ status: 409 });

    verify.mockResolvedValue(paid(reference, total, "USD"));
    await expect(confirmCheckout(reference)).rejects.toMatchObject({ status: 409 });

    expect(await prisma.order.count()).toBe(0);
    expect((await prisma.checkoutSession.findUniqueOrThrow({ where: { reference } })).status).toBe("PENDING");
  });

  it("creates no order while Paystack still says the payment is pending", async () => {
    const { reference } = await pendingCheckout();
    for (const status of ["abandoned", "ongoing", "failed"]) {
      verify.mockResolvedValue({ status, reference, amount: 0, currency: "NGN", paid_at: null });
      expect((await confirmCheckout(reference)).status).toBe("PENDING");
    }
    expect(await prisma.order.count()).toBe(0);
  });

  it("flags the order when the buyer pays after the hold expired and stock is gone", async () => {
    const { item, reference, total } = await pendingCheckout(5);
    await prisma.checkoutSession.update({ where: { reference }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    expect(await expireStaleCheckouts()).toBe(1);
    // Someone else buys everything while the hold is released.
    await prisma.inventoryItem.update({ where: { id: item.id }, data: { quantity: 0 } });

    verify.mockResolvedValue(paid(reference, total));
    await confirmCheckout(reference);

    const order = await prisma.order.findFirstOrThrow();
    expect(order.note).toMatch(/not enough stock/i);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).quantity).toBe(0);
  });

  it("re-takes the stock when a late payment arrives and stock is still there", async () => {
    const { item, reference, total } = await pendingCheckout(2);
    await prisma.checkoutSession.update({ where: { reference }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    await expireStaleCheckouts();
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).quantity).toBe(10);

    verify.mockResolvedValue(paid(reference, total));
    await confirmCheckout(reference);

    expect((await prisma.order.findFirstOrThrow()).note).toBeNull();
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).quantity).toBe(8);
  });
});

describe("expireStaleCheckouts", () => {
  it("releases held stock only for sessions past their hold", async () => {
    const { item, buyer } = await setup({ quantity: 10 });
    const stale = await startCheckout(buyerOf(buyer), checkoutInput(item.id, 3), ORIGIN);
    await startCheckout(buyerOf(buyer), checkoutInput(item.id, 2), ORIGIN); // still within its hold
    await prisma.checkoutSession.update({ where: { reference: stale.reference }, data: { expiresAt: new Date(Date.now() - 1000) } });

    expect(await expireStaleCheckouts()).toBe(1);
    // A second sweep must not release the same stock twice.
    expect(await expireStaleCheckouts()).toBe(0);

    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).quantity).toBe(8);
    expect((await prisma.checkoutSession.findUniqueOrThrow({ where: { reference: stale.reference } })).status).toBe("EXPIRED");
  });
});

describe("returnOrigin", () => {
  it("honours our own origins and refuses anything else", () => {
    expect(returnOrigin(undefined)).toBe("http://localhost:3020");
    expect(returnOrigin("http://localhost:3020")).toBe("http://localhost:3020");
    expect(returnOrigin("https://evil.example")).toBe("http://localhost:3020");
    expect(returnOrigin("https://demo-tunnel.trycloudflare.com")).toBe("https://demo-tunnel.trycloudflare.com");
    expect(returnOrigin("https://trycloudflare.com.evil.example")).toBe("http://localhost:3020");
  });
});
