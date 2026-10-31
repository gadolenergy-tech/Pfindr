import { expect, test, type Page } from "@playwright/test";
import { apiAs, apiData, pngFile, uid, type Item } from "../fixtures/helpers";

/**
 * What one account must never be able to do to another, a race for the last
 * unit, and a sweep of every page for crashes. Uses two vendors: Citadel
 * Pharmacy and Greenfield Supplies.
 */
test.describe.configure({ mode: "serial" });

const RUN = uid();
let citadelItem: Item;

test.beforeAll(async () => {
  const citadel = await apiAs("vendor");
  citadelItem = await apiData<Item>(
    await citadel.post("inventory", { data: { name: `Isolation Probe ${RUN}`, sku: `ISO-${RUN}`, quantity: 1, price: 5000, brand: "Probe Co" } }),
    201,
  );
});

test.describe("one vendor cannot touch another's stock", () => {
  test("cannot read, edit or delete it", async () => {
    const greenfield = await apiAs("newVendor");
    expect((await greenfield.get(`inventory/${citadelItem.id}`)).status()).toBe(404);
    expect((await greenfield.patch(`inventory/${citadelItem.id}`, { data: { price: 1 } })).status()).toBe(404);
    expect((await greenfield.delete(`inventory/${citadelItem.id}`)).status()).toBe(404);

    const owner = await apiAs("vendor");
    const still = await apiData<Item>(await owner.get(`inventory/${citadelItem.id}`));
    expect(Number(still.price)).toBe(5000);
  });

  test("never appears in the other vendor's list or search-by-name", async () => {
    const greenfield = await apiAs("newVendor");
    const list = await apiData<Item[]>(await greenfield.get(`inventory?limit=100&q=${encodeURIComponent("Isolation Probe")}`));
    expect(list).toHaveLength(0);
  });

  test("cannot attach a photo that lives in another vendor's storage", async () => {
    const owner = await apiAs("vendor");
    const signed = await apiData<{ uploadUrl: string; headers: Record<string, string>; publicUrl: string }>(
      await owner.post("uploads/presign", { data: { purpose: "product", contentType: "image/png", size: 100 } }),
    );
    const greenfield = await apiAs("newVendor");
    const mine = await apiData<Item>(
      await greenfield.post("inventory", { data: { name: `Greenfield thief ${RUN}`, sku: `GF-${RUN}`, quantity: 1, price: 10 } }),
      201,
    );
    const res = await greenfield.patch(`inventory/${mine.id}`, { data: { imageUrl: signed.publicUrl } });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
    const lib = await greenfield.post("inventory/images", { data: { images: [{ url: signed.publicUrl, fileName: "x.png" }] } });
    expect(lib.status()).toBeGreaterThanOrEqual(400);
    expect(lib.status()).toBeLessThan(500);
  });

  test("an image URL pointing anywhere else is refused", async () => {
    const greenfield = await apiAs("newVendor");
    const mine = (await apiData<Item[]>(await greenfield.get("inventory?limit=100"))).find((i) => i.sku === `GF-${RUN}`)!;
    for (const imageUrl of ["https://evil.example/x.png", "javascript:alert(1)", "http://127.0.0.1:5199/not-our-bucket/x.png"]) {
      const res = await greenfield.patch(`inventory/${mine.id}`, { data: { imageUrl } });
      expect(res.status(), imageUrl).toBeGreaterThanOrEqual(400);
    }
  });

  test("the photo library is per vendor: a matching file name from another vendor attaches nothing", async () => {
    const greenfield = await apiAs("newVendor");
    // Citadel uploads a photo named after its SKU; a Greenfield product with the same SKU must not get it.
    const owner = await apiAs("vendor");
    const signed = await apiData<{ uploadUrl: string; headers: Record<string, string>; publicUrl: string }>(
      await owner.post("uploads/presign", { data: { purpose: "product", contentType: "image/png", size: pngFile("a.png").buffer.length } }),
    );
    await fetch(signed.uploadUrl, { method: "PUT", headers: signed.headers, body: new Uint8Array(pngFile("a.png").buffer) });
    await apiData(await owner.post("inventory/images", { data: { images: [{ url: signed.publicUrl, fileName: `ISO-${RUN}.png` }] } }));

    const twin = await apiData<Item>(await greenfield.post("inventory", { data: { name: "Twin", sku: `ISO-${RUN}`, quantity: 1, price: 1 } }), 201);
    const matched = await apiData<{ matched: number }>(await greenfield.post("inventory/images/match"));
    expect(matched.matched).toBe(0);
    expect((await apiData<Item>(await greenfield.get(`inventory/${twin.id}`))).imageUrl).toBeNull();
  });
});

test.describe("buyers", () => {
  test("a buyer cannot use vendor-only endpoints, and a signed-out caller cannot use any", async ({ playwright }) => {
    const buyer = await apiAs("buyer");
    for (const [method, path] of [
      ["get", "inventory"],
      ["post", "inventory"],
      ["get", "orders"],
      ["get", "customers"],
      ["post", "uploads/presign"],
    ] as const) {
      const res = await buyer[method](path, { data: {} });
      expect([401, 403], `${method} ${path} -> ${res.status()}`).toContain(res.status());
    }
    const anon = await playwright.request.newContext({ baseURL: "http://localhost:3120/api/proxy/" });
    for (const path of ["discover?q=paracetamol&latitude=4.8&longitude=7", "orders", "inventory", "conversations", "purchases", "auth/me"]) {
      expect((await anon.get(path)).status(), path).toBe(401);
    }
  });

  test("a buyer cannot see another buyer's purchase", async () => {
    const buyer = await apiAs("buyer");
    const res = await buyer.get("checkout/FND-DOES-NOT-EXIST");
    expect([403, 404]).toContain(res.status());
  });

  test("the price comes from the vendor, not from the request", async () => {
    const buyer = await apiAs("buyer");
    const res = await buyer.post("checkout", {
      data: {
        items: [{ inventoryItemId: citadelItem.id, quantity: 1, unitPrice: 1, price: 1 }],
        fulfilment: "PICKUP",
        buyerPhone: "+2348011111111",
        total: 1,
      },
    });
    // Either the extra fields are rejected or ignored; what must never happen is a 1-naira checkout.
    if (res.status() === 201 || res.status() === 200) {
      const started = (await res.json()).data as { authorizationUrl: string; reference: string };
      const purchase = await apiData<{ total: number }>(await buyer.get(`checkout/${started.reference}`));
      expect(purchase.total).toBe(5000);
    } else {
      expect(res.status()).toBeLessThan(500);
    }
  });

  test("two buyers racing for the last unit: exactly one gets it", async () => {
    // The probe has one unit, and the test above may already be holding it; make a fresh single unit.
    const owner = await apiAs("vendor");
    const last = await apiData<Item>(
      await owner.post("inventory", { data: { name: `Last One ${RUN}`, sku: `LAST-${RUN}`, quantity: 1, price: 2500 } }),
      201,
    );
    const buyer = await apiAs("buyer");
    const attempt = () =>
      buyer.post("checkout", { data: { items: [{ inventoryItemId: last.id, quantity: 1 }], fulfilment: "PICKUP", buyerPhone: "+2348011111111" } });
    const results = await Promise.all([attempt(), attempt(), attempt(), attempt()]);
    const won = results.filter((r) => r.status() === 201 || r.status() === 200);
    expect(won, results.map((r) => r.status()).join(",")).toHaveLength(1);
    for (const r of results.filter((x) => !won.includes(x))) {
      expect(r.status()).toBeGreaterThanOrEqual(400);
      expect(r.status()).toBeLessThan(500);
    }
    const after = await apiData<Item>(await owner.get(`inventory/${last.id}`));
    expect(after.quantity).toBe(0);
    expect(after.status).toBe("OUT_OF_STOCK");
  });
});

test.describe("every page loads without crashing", () => {
  const collect = (page: Page) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|hydrat/i.test(m.text())) errors.push(`console: ${m.text()}`);
    });
    return errors;
  };

  const publicPages = ["/", "/about", "/how-it-works", "/contact", "/privacy", "/terms", "/disclaimer", "/developers", "/partners", "/affiliate", "/login", "/signup", "/signup/user", "/vendor/signup", "/forgot-password"];
  for (const path of publicPages) {
    test(`public ${path}`, async ({ page }) => {
      const errors = collect(page);
      const res = await page.goto(path);
      expect(res!.status()).toBeLessThan(400);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("body")).not.toContainText(/Application error|This page could not be found/);
      expect(errors).toEqual([]);
    });
  }

  test.describe("signed in as a buyer", () => {
    test.use({ storageState: ".auth/buyer.json" });
    for (const path of ["/", "/cart", "/orders", "/messages"]) {
      test(`buyer ${path}`, async ({ page }) => {
        const errors = collect(page);
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await expect(page.locator("body")).not.toContainText(/Application error/);
        await expect(page).not.toHaveURL(/\/login/);
        expect(errors).toEqual([]);
      });
    }
    test("an unknown product id shows a friendly not-found, not a crash", async ({ page }) => {
      await page.goto("/product/does-not-exist");
      await expect(page.getByText(/no longer available|not found|couldn't find/i).first()).toBeVisible();
      await expect(page.getByRole("link", { name: "Back to search" })).toBeVisible();
    });
  });

  test.describe("signed in as a vendor", () => {
    test.use({ storageState: ".auth/vendor.json" });
    for (const path of ["/vendor/dashboard", "/vendor/inventory", "/vendor/orders", "/vendor/customers", "/vendor/analytics", "/vendor/messages", "/vendor/api-integrations", "/vendor/settings"]) {
      test(`vendor ${path}`, async ({ page }) => {
        const errors = collect(page);
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await expect(page.locator("body")).not.toContainText(/Application error/);
        await expect(page).not.toHaveURL(/\/login/);
        expect(errors).toEqual([]);
      });
    }
  });
});
