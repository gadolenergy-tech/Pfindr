import crypto from "crypto";
import { env } from "../env";
import { AppError } from "./errors";

/**
 * Minimal Paystack client: initialise a transaction, verify it, and check a
 * webhook signature. Amounts go to Paystack in the currency's subunit (kobo).
 * https://paystack.com/docs/api/transaction/
 */

const BASE_URL = "https://api.paystack.co";

export const paymentsEnabled = () => env.paystack.secretKey.length > 0;

function requireKey(): string {
  if (!paymentsEnabled()) {
    throw new AppError(503, "PAYMENTS_DISABLED", "Online payment is not set up yet. Message the vendor to buy.");
  }
  return env.paystack.secretKey;
}

type PaystackEnvelope<T> = { status: boolean; message: string; data: T };

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireKey()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = (await res.json().catch(() => null)) as PaystackEnvelope<T> | null;
  if (!res.ok || !body?.status) {
    throw new AppError(502, "PAYMENT_PROVIDER_ERROR", body?.message ?? `Paystack returned ${res.status}`);
  }
  return body.data;
}

export const toSubunit = (amount: number) => Math.round(amount * 100);

export async function initializeTransaction(input: {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}) {
  return call<{ authorization_url: string; access_code: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: toSubunit(input.amount),
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });
}

export type VerifiedTransaction = {
  status: "success" | "failed" | "abandoned" | "ongoing" | "pending" | "reversed" | string;
  reference: string;
  /** In subunits. */
  amount: number;
  currency: string;
  paid_at: string | null;
};

export async function verifyTransaction(reference: string) {
  return call<VerifiedTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

/** Paystack signs the raw webhook body with HMAC-SHA512 of the secret key. */
export function isValidWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature || !paymentsEnabled()) return false;
  const expected = crypto.createHmac("sha512", env.paystack.secretKey).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
