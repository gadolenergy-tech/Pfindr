import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../src/env";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { signAccessToken } from "../src/lib/jwt";
import { adminBalances, recordPayout, vendorBalances } from "../src/services/payout.service";
import { makeUser, makeVendor, resetDb } from "./factories";

const config = env as { platformFeePercent: number };
let seq = 0;

/** An order as the database stores it; defaults to a paid, un-refunded checkout. */
async function order(
  vendorId: string,
  total: number,
  extra: Partial<{ source: "CHECKOUT" | "VENDOR"; paidAt: Date | null; status: "FULFILLED" | "REFUNDED" | "CANCELLED" | "PENDING"; currency: string }> = {},
) {
  return prisma.order.create({
    data: {
      orderNumber: `ORD-T-${Date.now()}-${seq++}`,
      vendorId,
      subtotal: total,
      total,
      currency: extra.currency ?? "NGN",
      status: extra.status ?? "PENDING",
      source: extra.source ?? "CHECKOUT",
      paidAt: extra.paidAt === undefined ? new Date() : extra.paidAt,
    },
  });
}

beforeEach(async () => {
  await resetDb();
  config.platformFeePercent = 0;
});
afterEach(() => {
  config.platformFeePercent = 0;
});

describe("balances", () => {
  it("counts only paid, un-refunded checkout orders", async () => {
    const v = await makeVendor();
    await order(v.id, 10_000);
    await order(v.id, 2_500, { status: "FULFILLED" });
    await order(v.id, 99_999, { status: "REFUNDED" });
    await order(v.id, 99_999, { status: "CANCELLED" });
    await order(v.id, 99_999, { paidAt: null }); // never paid
    await order(v.id, 99_999, { source: "VENDOR" }); // vendor's own sale, no money held

    expect(await vendorBalances(v.id)).toEqual([
      { currency: "NGN", gross: 12_500, fee: 0, earned: 12_500, paidOut: 0, owed: 12_500 },
    ]);
  });

  it("takes the platform fee out of what is owed", async () => {
    const v = await makeVendor();
    await order(v.id, 10_000);
    config.platformFeePercent = 7.5;

    const [b] = await vendorBalances(v.id);
    expect(b).toMatchObject({ gross: 10_000, fee: 750, earned: 9_250, owed: 9_250 });
  });

  it("keeps each currency separate and each vendor separate", async () => {
    const [a, b] = [await makeVendor(), await makeVendor()];
    await order(a.id, 1_000);
    await order(a.id, 50, { currency: "USD" });
    await order(b.id, 7_000);

    const forA = await vendorBalances(a.id);
    expect(forA.map((x) => [x.currency, x.owed]).sort()).toEqual([["NGN", 1_000], ["USD", 50]]);
    expect((await vendorBalances(b.id)).map((x) => x.owed)).toEqual([7_000]);
  });

  it("adds up fractional amounts without drift", async () => {
    const v = await makeVendor();
    for (let i = 0; i < 10; i++) await order(v.id, 0.1);
    expect((await vendorBalances(v.id))[0]!.owed).toBe(1);
  });

  it("lists vendors for the admin ledger, largest debt first", async () => {
    const [small, big] = [await makeVendor(), await makeVendor()];
    await order(small.id, 100);
    await order(big.id, 900);
    const rows = await adminBalances();
    expect(rows.map((r) => r.vendorId)).toEqual([big.id, small.id]);
    expect(rows[0]!.businessName).toBe(big.businessName);
  });
});

describe("recordPayout", () => {
  const input = (amount: number, over: Record<string, unknown> = {}) => ({ currency: "NGN", amount, reference: "TRF-1", note: null, ...over });

  it("reduces what is owed and keeps the reference", async () => {
    const v = await makeVendor();
    const admin = await makeUser({ role: "ADMIN" });
    await order(v.id, 10_000);

    const payout = await recordPayout(admin.id, v.id, input(4_000));

    expect(payout).toMatchObject({ amount: 4_000, currency: "NGN", reference: "TRF-1" });
    expect((await vendorBalances(v.id))[0]).toMatchObject({ earned: 10_000, paidOut: 4_000, owed: 6_000 });
    expect((await prisma.vendorPayout.findFirstOrThrow()).createdById).toBe(admin.id);
  });

  it("refuses to pay more than is owed, or anything in a currency with no balance", async () => {
    const v = await makeVendor();
    const admin = await makeUser({ role: "ADMIN" });
    await order(v.id, 1_000);

    await expect(recordPayout(admin.id, v.id, input(1_000.01))).rejects.toMatchObject({ status: 409 });
    await expect(recordPayout(admin.id, v.id, input(1, { currency: "USD" }))).rejects.toMatchObject({ status: 409 });
    expect(await prisma.vendorPayout.count()).toBe(0);

    await recordPayout(admin.id, v.id, input(1_000)); // exactly what is owed is fine
    await expect(recordPayout(admin.id, v.id, input(0.01))).rejects.toMatchObject({ status: 409 });
  });

  it("rejects sub-cent amounts and unknown vendors", async () => {
    const v = await makeVendor();
    const admin = await makeUser({ role: "ADMIN" });
    await order(v.id, 1_000);
    await expect(recordPayout(admin.id, v.id, input(10.005))).rejects.toMatchObject({ status: 400 });
    await expect(recordPayout(admin.id, "missing", input(10))).rejects.toMatchObject({ status: 404 });
  });

  it("lets only one of many simultaneous full payouts through", async () => {
    const v = await makeVendor();
    const admins = await Promise.all(Array.from({ length: 8 }, () => makeUser({ role: "ADMIN" })));
    await order(v.id, 5_000);

    const results = await Promise.allSettled(admins.map((a) => recordPayout(a.id, v.id, input(5_000))));

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.vendorPayout.count()).toBe(1);
    expect((await vendorBalances(v.id))[0]!.owed).toBe(0);
  });

  it("goes negative when an order is refunded after the vendor was paid", async () => {
    const v = await makeVendor();
    const admin = await makeUser({ role: "ADMIN" });
    const o = await order(v.id, 3_000);
    await recordPayout(admin.id, v.id, input(3_000));
    await prisma.order.update({ where: { id: o.id }, data: { status: "REFUNDED" } });

    expect((await vendorBalances(v.id))[0]).toMatchObject({ earned: 0, paidOut: 3_000, owed: -3_000 });
  });
});

describe("payout endpoints", () => {
  let server: http.Server;
  let base: string;

  beforeAll(async () => {
    server = http.createServer(createApp());
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const call = (method: string, path: string, token?: string, body?: unknown) =>
    fetch(`${base}/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  const adminToken = async () => {
    const u = await makeUser({ role: "ADMIN" });
    return { id: u.id, token: signAccessToken({ sub: u.id, email: u.email, role: "ADMIN", vendorId: null }) };
  };
  const vendorToken = async () => {
    const v = await makeVendor();
    const u = await prisma.user.findUniqueOrThrow({ where: { id: v.userId } });
    return { vendor: v, token: signAccessToken({ sub: u.id, email: u.email, role: "VENDOR", vendorId: v.id }) };
  };

  it("is admin-only", async () => {
    const { vendor, token } = await vendorToken();
    const body = { currency: "NGN", amount: 1 };
    expect((await call("GET", "/admin/vendor-payouts")).status).toBe(401);
    expect((await call("GET", "/admin/vendor-payouts", token)).status).toBe(403);
    expect((await call("POST", `/admin/vendors/${vendor.id}/payouts`, token, body)).status).toBe(403);
  });

  it("records a payout, audits it, and shows it to the vendor", async () => {
    const admin = await adminToken();
    const { vendor, token: vToken } = await vendorToken();
    await order(vendor.id, 8_000);

    const res = await call("POST", `/admin/vendors/${vendor.id}/payouts`, admin.token, {
      currency: "ngn",
      amount: 3_000,
      reference: "TRF-9",
    });
    expect(res.status).toBe(201);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "VENDOR_PAYOUT_RECORDED" } });
    expect(audit).toMatchObject({ actorId: admin.id, entityType: "Vendor", entityId: vendor.id });

    const mine = (await (await call("GET", "/vendors/me/payouts", vToken)).json()) as {
      data: { balances: { owed: number }[]; payouts: { amount: number; reference: string }[] };
    };
    expect(mine.data.balances[0]!.owed).toBe(5_000);
    expect(mine.data.payouts).toEqual([expect.objectContaining({ amount: 3_000, reference: "TRF-9" })]);
  });

  it("returns 409 for an overpayment and 422 for a bad body", async () => {
    const admin = await adminToken();
    const { vendor } = await vendorToken();
    await order(vendor.id, 100);
    expect((await call("POST", `/admin/vendors/${vendor.id}/payouts`, admin.token, { currency: "NGN", amount: 101 })).status).toBe(409);
    expect((await call("POST", `/admin/vendors/${vendor.id}/payouts`, admin.token, { currency: "NGN", amount: -5 })).status).toBe(422);
    expect((await call("POST", `/admin/vendors/${vendor.id}/payouts`, admin.token, { currency: "NAIRA", amount: 5 })).status).toBe(422);
  });

  it("does not let a vendor read another vendor's payouts", async () => {
    const [a, b] = [await vendorToken(), await vendorToken()];
    await order(b.vendor.id, 1_000);
    const res = (await (await call("GET", "/vendors/me/payouts", a.token)).json()) as { data: { balances: unknown[] } };
    expect(res.data.balances).toEqual([]);
  });
});
