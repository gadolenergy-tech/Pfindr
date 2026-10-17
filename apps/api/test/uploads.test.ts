import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../src/env";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/lib/jwt";
import { assertOwnImageUrl, createUploadUrl } from "../src/lib/storage";
import { createInventoryItem, updateInventoryItem } from "../src/services/inventory.service";
import { makeItem, makeUser, makeVendor, resetDb } from "./factories";

const storage = env.storage as { bucket: string; accessKeyId: string; secretAccessKey: string; publicUrl: string; endpoint: string };
const PUBLIC = "https://cdn.test";

function configure(on: boolean) {
  Object.assign(storage, on
    ? { bucket: "finder-test", accessKeyId: "AKIATEST", secretAccessKey: "secret", publicUrl: PUBLIC, endpoint: "https://acct.r2.test" }
    : { bucket: "", accessKeyId: "", secretAccessKey: "", publicUrl: "", endpoint: "" });
}

beforeEach(async () => {
  await resetDb();
  configure(true);
});

describe("createUploadUrl", () => {
  it("scopes the key to the vendor and purpose and signs type and size", async () => {
    const up = await createUploadUrl("vend_1", { purpose: "product", contentType: "image/png", size: 1234 });

    expect(up.publicUrl).toMatch(/^https:\/\/cdn\.test\/vendors\/vend_1\/product\/[0-9a-f-]{36}\.png$/);
    const url = new URL(up.uploadUrl);
    expect(url.pathname).toContain(`/finder-test/${up.publicUrl.replace(`${PUBLIC}/`, "")}`);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    const signed = url.searchParams.get("X-Amz-SignedHeaders") ?? "";
    expect(signed).toContain("content-type");
    expect(signed).toContain("content-length");
    expect(up.headers).toEqual({ "Content-Type": "image/png" });
  });

  it("gives every upload its own key", async () => {
    const a = await createUploadUrl("v", { purpose: "logo", contentType: "image/webp", size: 10 });
    const b = await createUploadUrl("v", { purpose: "logo", contentType: "image/webp", size: 10 });
    expect(a.publicUrl).not.toBe(b.publicUrl);
  });

  it("refuses when storage is not configured", async () => {
    configure(false);
    await expect(createUploadUrl("v", { purpose: "logo", contentType: "image/png", size: 10 })).rejects.toMatchObject({ status: 503 });
  });
});

describe("assertOwnImageUrl", () => {
  it("allows nothing, null, and the vendor's own uploads", () => {
    expect(() => assertOwnImageUrl("v1", undefined)).not.toThrow();
    expect(() => assertOwnImageUrl("v1", null)).not.toThrow();
    expect(() => assertOwnImageUrl("v1", `${PUBLIC}/vendors/v1/logo/a.png`)).not.toThrow();
  });

  it("rejects other vendors' files, outside links, lookalike prefixes and traversal", () => {
    for (const url of [
      `${PUBLIC}/vendors/v2/logo/a.png`,
      "https://evil.example/a.png",
      `${PUBLIC}/vendors/v10/logo/a.png`, // prefix of v1 must not match v10
      `${PUBLIC}/vendors/v1/../v2/logo/a.png`,
      `${PUBLIC}.evil.example/vendors/v1/a.png`,
    ]) {
      expect(() => assertOwnImageUrl("v1", url), url).toThrow();
    }
  });

  it("rejects every URL when uploads are not configured", () => {
    configure(false);
    expect(() => assertOwnImageUrl("v1", `${PUBLIC}/vendors/v1/logo/a.png`)).toThrow();
  });
});

describe("inventory image URLs", () => {
  it("stores a vendor's own upload and refuses someone else's", async () => {
    const [mine, theirs] = [await makeVendor(), await makeVendor()];
    const own = `${PUBLIC}/vendors/${mine.id}/product/a.png`;
    const foreign = `${PUBLIC}/vendors/${theirs.id}/product/a.png`;
    const base = { name: "Rod", quantity: 1, unit: "bar", price: 10, currency: "NGN" } as const;

    const item = await createInventoryItem(mine.id, { ...base, imageUrl: own, lowStockThreshold: 5 } as never, {});
    expect(item.imageUrl).toBe(own);
    await expect(createInventoryItem(mine.id, { ...base, imageUrl: foreign, lowStockThreshold: 5 } as never, {})).rejects.toMatchObject({ status: 400 });

    const existing = await makeItem(mine.id);
    await expect(updateInventoryItem(mine.id, existing.id, { imageUrl: "https://evil.example/x.png" })).rejects.toMatchObject({ status: 400 });
    await expect(updateInventoryItem(mine.id, existing.id, { imageUrl: own })).resolves.toMatchObject({ imageUrl: own });
    await expect(updateInventoryItem(mine.id, existing.id, { imageUrl: null })).resolves.toMatchObject({ imageUrl: null });
  });
});

describe("POST /uploads/presign", () => {
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

  const post = (body: unknown, token?: string) =>
    fetch(`${base}/api/uploads/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });

  const tokenFor = async (role: "USER" | "VENDOR") => {
    if (role === "USER") {
      const u = await makeUser();
      return { token: signAccessToken({ sub: u.id, email: u.email, role: "USER", vendorId: null }), vendorId: null };
    }
    const v = await makeVendor();
    const u = await (await import("../src/lib/prisma")).prisma.user.findUniqueOrThrow({ where: { id: v.userId } });
    return { token: signAccessToken({ sub: u.id, email: u.email, role: "VENDOR", vendorId: v.id }), vendorId: v.id };
  };

  const valid = { purpose: "logo", contentType: "image/png", size: 1000 };

  it("requires a signed-in vendor", async () => {
    expect((await post(valid)).status).toBe(401);
    expect((await post(valid, (await tokenFor("USER")).token)).status).toBe(403);
  });

  it("returns an upload URL under the caller's own prefix", async () => {
    const { token, vendorId } = await tokenFor("VENDOR");
    const res = await post(valid, token);
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: { publicUrl: string; uploadUrl: string } };
    expect(data.publicUrl.startsWith(`${PUBLIC}/vendors/${vendorId}/logo/`)).toBe(true);
  });

  it("rejects non-images and oversize files", async () => {
    const { token } = await tokenFor("VENDOR");
    expect((await post({ ...valid, contentType: "text/html" }, token)).status).toBe(422);
    expect((await post({ ...valid, contentType: "image/svg+xml" }, token)).status).toBe(422);
    expect((await post({ ...valid, size: 5 * 1024 * 1024 + 1 }, token)).status).toBe(422);
    expect((await post({ ...valid, size: 0 }, token)).status).toBe(422);
  });
});
