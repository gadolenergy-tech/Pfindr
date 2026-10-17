import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/paystack", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/paystack")>()),
  initializeTransaction: vi.fn(),
  verifyTransaction: vi.fn(),
}));

import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { initializeTransaction, isValidWebhookSignature, verifyTransaction } from "../src/lib/paystack";
import { startCheckout } from "../src/services/checkout.service";
import { checkoutInput, makeItem, makeUser, makeVendor, resetDb } from "./factories";

const SECRET = "sk_test_unit";
const sign = (body: string) => crypto.createHmac("sha512", SECRET).update(body).digest("hex");

describe("isValidWebhookSignature", () => {
  const body = Buffer.from('{"event":"charge.success"}');

  it("accepts the HMAC-SHA512 of the raw body", () => {
    expect(isValidWebhookSignature(body, sign(body.toString()))).toBe(true);
  });

  it("rejects a missing, wrong or tampered signature", () => {
    expect(isValidWebhookSignature(body, undefined)).toBe(false);
    expect(isValidWebhookSignature(body, "deadbeef")).toBe(false);
    expect(isValidWebhookSignature(Buffer.from('{"event":"charge.success","x":1}'), sign(body.toString()))).toBe(false);
  });
});

describe("POST /webhooks/paystack", () => {
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

  beforeEach(async () => {
    await resetDb();
    vi.mocked(initializeTransaction).mockReset().mockResolvedValue({
      authorization_url: "https://checkout.paystack.test/abc",
      access_code: "abc",
      reference: "ignored",
    });
    vi.mocked(verifyTransaction).mockReset();
  });

  const post = (body: string, signature?: string) =>
    fetch(`${base}/api/webhooks/paystack`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(signature ? { "x-paystack-signature": signature } : {}) },
      body,
    });

  async function pending() {
    const vendor = await makeVendor();
    const item = await makeItem(vendor.id, { quantity: 5, price: 1000 });
    const buyer = await makeUser();
    const { reference } = await startCheckout(
      { userId: buyer.id, email: buyer.email, vendorId: null },
      checkoutInput(item.id, 2),
      "http://localhost:3020",
    );
    return reference;
  }

  it("answers 401 to an unsigned or wrongly signed request and creates nothing", async () => {
    const reference = await pending();
    const body = JSON.stringify({ event: "charge.success", data: { reference } });

    expect((await post(body)).status).toBe(401);
    expect((await post(body, sign(body + "x"))).status).toBe(401);
    expect(await prisma.order.count()).toBe(0);
    expect(vi.mocked(verifyTransaction)).not.toHaveBeenCalled();
  });

  it("confirms the payment on a correctly signed charge.success, once, however often it is retried", async () => {
    const reference = await pending();
    vi.mocked(verifyTransaction).mockResolvedValue({
      status: "success",
      reference,
      amount: 200_000,
      currency: "NGN",
      paid_at: new Date().toISOString(),
    });
    const body = JSON.stringify({ event: "charge.success", data: { reference } });

    for (let i = 0; i < 3; i++) expect((await post(body, sign(body))).status).toBe(200);

    expect(await prisma.order.count()).toBe(1);
    expect((await prisma.checkoutSession.findUniqueOrThrow({ where: { reference } })).status).toBe("PAID");
  });

  it("ignores events that are not one of our checkouts", async () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference: "OTHER-123" } });
    expect((await post(body, sign(body))).status).toBe(200);
    expect(vi.mocked(verifyTransaction)).not.toHaveBeenCalled();
  });
});
