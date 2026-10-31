import { expect, request as pwRequest, type APIRequestContext, type Page } from "@playwright/test";
import { MOCK_URL, WEB_URL } from "../env";

/** A valid 1x1 PNG; `seed` changes one byte so each file is distinct on the wire. */
export function png(seed = 0): Buffer {
  const base = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  );
  const out = Buffer.from(base);
  out[out.length - 20] = seed % 256; // inside the IDAT/CRC area; browsers still decode it as an image
  return out;
}

export const pngFile = (name: string, seed = 0) => ({ name, mimeType: "image/png", buffer: png(seed) });

export const csvFile = (name: string, body: string) => ({ name, mimeType: "text/csv", buffer: Buffer.from(body) });

/** Short unique suffix so repeat runs and parallel specs never share names. */
export const uid = () => Math.random().toString(36).slice(2, 7).toUpperCase();

/** An API client that carries a stored session, going through the web app's /api/proxy like the browser does. */
export async function apiAs(role: "buyer" | "vendor" | "newVendor"): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: `${WEB_URL}/api/proxy/`, storageState: `.auth/${role}.json` });
}

type Envelope<T> = { ok: boolean; data: T; error?: { code: string; message: string } };

export async function apiData<T>(res: Awaited<ReturnType<APIRequestContext["get"]>>, expected = 200): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as Envelope<T>;
  expect(res.status(), JSON.stringify(body)).toBe(expected);
  return body.data;
}

export type Item = {
  id: string;
  name: string;
  sku: string | null;
  brand: string | null;
  description: string | null;
  imageUrl: string | null;
  quantity: number;
  price: number | string;
  status: string;
  vendorId?: string;
};

/** Lists the signed-in vendor's own inventory (up to 100). */
export async function myItems(api: APIRequestContext, q = ""): Promise<Item[]> {
  return apiData<Item[]>(await api.get(`inventory?limit=100${q ? `&q=${encodeURIComponent(q)}` : ""}`));
}

/** The mock bucket serves back whatever was PUT; true if `url` resolves to an image. */
export async function isServedImage(url: string): Promise<boolean> {
  const res = await fetch(url);
  return res.ok && (res.headers.get("content-type") ?? "").startsWith("image/");
}

export async function mockObjectKeys(): Promise<string[]> {
  const res = await fetch(`${MOCK_URL}/__objects`);
  return ((await res.json()) as { keys: string[] }).keys;
}

/** Marks a Paystack reference as paid on the stand-in, as the hosted page would. */
export async function payOnMockPaystack(reference: string) {
  const res = await fetch(`${MOCK_URL}/__pay/${encodeURIComponent(reference)}`, { method: "POST" });
  expect(res.ok, `mock paystack: ${res.status}`).toBe(true);
}

/** Toasts render in a live region; match by their text. */
export const toast = (page: Page, text: string | RegExp) => page.getByText(text).first();
