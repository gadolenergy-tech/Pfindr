import { expect, test, type Page } from "@playwright/test";
import { apiAs, apiData, payOnMockPaystack, pngFile, uid, myItems, type Item } from "../fixtures/helpers";

/**
 * The buyer's story, with real stock from the "Citadel Pharmacy" demo vendor:
 * search, compare two brands of the same product by their photos and
 * descriptions, add both to the cart, pay once, and see the order land on both
 * sides. Paystack is the local stand-in.
 */
test.use({
  storageState: ".auth/buyer.json",
  geolocation: { latitude: 4.8156, longitude: 7.0498 }, // Port Harcourt
  permissions: ["geolocation"],
});
test.describe.configure({ mode: "serial" });

const RUN = uid();
const NAME = `Zentrix Allergy Relief ${RUN}`;
const ALPHA = { sku: `ZX-A-${RUN}`, brand: "Alpha Labs", description: "Cetirizine 10mg, strip of 10 tablets. Non-drowsy.", qty: 20, price: 1500 };
const BETA = { sku: `ZX-B-${RUN}`, brand: "Beta Pharma", description: "Loratadine 10mg, blister of 10. Made in Lagos.", qty: 3, price: 1800 };

/** One browser session for the whole story, as a real buyer has: the cart lives in the browser. */
let page: Page;
let alpha: Item;
let beta: Item;

async function uploadAs(api: Awaited<ReturnType<typeof apiAs>>, seed: number): Promise<string> {
  const file = pngFile("p.png", seed);
  const signed = await apiData<{ uploadUrl: string; headers: Record<string, string>; publicUrl: string }>(
    await api.post("uploads/presign", { data: { purpose: "product", contentType: file.mimeType, size: file.buffer.length } }),
  );
  const put = await fetch(signed.uploadUrl, { method: "PUT", headers: signed.headers, body: new Uint8Array(file.buffer) });
  expect(put.ok).toBe(true);
  return signed.publicUrl;
}

async function openSearch(page: Page, term: string) {
  await page.goto("/");
  // The dev server hydrates late; a click before that does nothing, so retry until the modal opens.
  await expect(async () => {
    await page.getByTestId("btn-hero-search").click();
    await expect(page.getByTestId("search-modal-panel")).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 20_000 });
  await page.getByTestId("search-modal-input").fill(term);
}

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({
    storageState: ".auth/buyer.json",
    geolocation: { latitude: 4.8156, longitude: 7.0498 },
    permissions: ["geolocation"],
  });
  page = await context.newPage();
  const vendor = await apiAs("vendor");
  const make = async (p: typeof ALPHA, seed: number) => {
    const imageUrl = await uploadAs(vendor, seed);
    return apiData<Item>(
      await vendor.post("inventory", {
        data: { name: NAME, sku: p.sku, brand: p.brand, description: p.description, quantity: p.qty, price: p.price, unit: "pack", imageUrl },
      }),
      201,
    );
  };
  alpha = await make(ALPHA, 11);
  beta = await make(BETA, 12);
});

test.afterAll(async () => {
  await page.context().close();
});

test("search shows both brands, each with Buy now, and no 'Message vendor' button", async () => {
  await openSearch(page, NAME);
  const a = page.getByTestId(`search-result-${alpha.id}`);
  const b = page.getByTestId(`search-result-${beta.id}`);
  await expect(a).toBeVisible();
  await expect(b).toBeVisible();
  await expect(a).toContainText("Alpha Labs");
  await expect(b).toContainText("Beta Pharma");
  await expect(page.getByTestId(`search-buy-${alpha.id}`)).toBeVisible();
  await expect(page.getByTestId(`search-distance-${alpha.id}`)).toBeVisible();

  // Tapping a result reveals the second action: view the product's images.
  await a.click();
  const details = page.getByTestId(`search-result-details-${alpha.id}`);
  await expect(details).toBeVisible();
  await expect(page.getByTestId(`search-view-images-${alpha.id}`)).toHaveText(/View product/);
  await expect(page.getByText("Message vendor")).toHaveCount(0);
  await expect(details.getByText("Citadel Pharmacy")).toBeVisible();
});

test("View product opens a page with the photo, brand, description and vendor", async () => {
  await openSearch(page, NAME);
  await page.getByTestId(`search-result-${alpha.id}`).click();
  await page.getByTestId(`search-view-images-${alpha.id}`).click();
  await expect(page).toHaveURL(new RegExp(`/product/${alpha.id}`));

  const img = page.getByTestId("product-image");
  await expect(img).toBeVisible();
  // A real, decodable image served from the bucket, not a broken placeholder.
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await expect(page.getByTestId("product-brand")).toContainText("Alpha Labs");
  await expect(page.getByTestId("product-description")).toHaveText(ALPHA.description);
  await expect(page.getByRole("heading", { name: NAME })).toBeVisible();
  await expect(page.getByText("Citadel Pharmacy").first()).toBeVisible();
  await expect(page.getByText("₦1,500")).toBeVisible();
  await expect(page.getByText("20 pack in stock")).toBeVisible();
  await expect(page.getByText(/Check the photo, brand and description above before you pay/)).toBeVisible();
});

test("the other brand has its own page, photo and description", async () => {
  await page.goto(`/product/${beta.id}`);
  await expect(page.getByTestId("product-brand")).toContainText("Beta Pharma");
  await expect(page.getByTestId("product-description")).toHaveText(BETA.description);
  await expect(page.getByText("₦1,800")).toBeVisible();
  await expect(page.getByText("3 pack in stock")).toBeVisible();
  // Low stock is flagged to the buyer.
  await expect(page.getByText("3 pack in stock")).toHaveClass(/amber/);
  const alphaSrc = await (async () => {
    await page.goto(`/product/${alpha.id}`);
    return page.getByTestId("product-image").getAttribute("src");
  })();
  await page.goto(`/product/${beta.id}`);
  expect(await page.getByTestId("product-image").getAttribute("src")).not.toBe(alphaSrc);
});

test("quantity on the product page is capped at what the vendor has", async () => {
  await page.goto(`/product/${beta.id}`);
  const qty = page.getByRole("spinbutton");
  await expect(qty).toHaveValue("1");
  await expect(page.getByRole("button", { name: "Fewer" })).toBeDisabled();
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: "More" }).click();
  await expect(qty).toHaveValue("3");
  await expect(page.getByRole("button", { name: "More" })).toBeDisabled();
  await qty.fill("99");
  await expect(qty).toHaveValue("3");
});

test("add to cart from the product page, return to search, add the other brand", async () => {
  await page.goto(`/product/${alpha.id}`);
  await page.getByTestId("product-add-to-cart").click();
  await expect(page.getByTestId("product-in-cart")).toContainText("1 in your cart");
  await expect(page.getByTestId("nav-cart-count")).toHaveText("1");

  // Back to search from the product page keeps the buyer's search.
  await page.getByTestId("product-back").click();
  await expect(page.getByTestId("search-modal-panel")).toBeVisible();

  await page.goto(`/product/${beta.id}`);
  await page.getByRole("button", { name: "More" }).click(); // 2 of Beta
  await page.getByTestId("product-add-to-cart").click();
  // The badge counts units: 1 Alpha + 2 Beta.
  await expect(page.getByTestId("nav-cart-count")).toHaveText("3");
});

test("the cart survives a reload and groups lines by vendor with the right subtotal", async () => {
  await page.goto("/cart");
  await page.reload();
  await expect(page.getByTestId(`cart-line-${alpha.id}`)).toContainText(NAME);
  await expect(page.getByTestId(`cart-line-${beta.id}`)).toContainText("Beta Pharma");
  // 1 x 1,500 + 2 x 1,800
  await expect(page.locator('[data-testid^="cart-subtotal-"]')).toContainText("5,100");
  await expect(page.locator('[data-testid^="cart-vendor-"]')).toHaveCount(1);
});

test("cart quantity and remove controls work and respect stock", async () => {
  await page.goto("/cart");
  const betaLine = page.getByTestId(`cart-line-${beta.id}`);
  await betaLine.getByRole("button", { name: "More" }).click(); // 3 = all there is
  await expect(betaLine.getByRole("button", { name: "More" })).toBeDisabled();
  await expect(page.locator('[data-testid^="cart-subtotial-"]')).toHaveCount(0);
  await expect(page.locator('[data-testid^="cart-subtotal-"]')).toContainText("6,900");
  await betaLine.getByRole("button", { name: "Fewer" }).click();
  await betaLine.getByRole("button", { name: "Fewer" }).click(); // back to 1
  await expect(page.locator('[data-testid^="cart-subtotal-"]')).toContainText("3,300");

  await page.getByRole("button", { name: `Remove ${NAME}` }).first().click();
  await expect(page.locator('[data-testid^="cart-line-"]')).toHaveCount(1);
  // Put it back for the checkout test.
  await page.goto(`/product/${alpha.id}`);
  await page.getByTestId("product-add-to-cart").click();
  await expect(page.getByTestId("nav-cart-count")).toHaveText("2");
});

test("pay now validates the checkout form, then hands off to the payment page", async () => {
  await page.goto("/cart");
  await page.locator('[data-testid^="cart-pay-"]').click();
  const dialog = page.getByTestId("checkout-dialog");
  await expect(dialog).toBeVisible();

  // Delivery needs an address; a phone number is always needed.
  await dialog.getByText("Delivery", { exact: true }).click();
  await dialog.getByRole("button", { name: /^Pay/ }).click();
  await expect(dialog.locator(".text-red-400, [role=alert]").first()).toBeVisible();
  await expect(page).toHaveURL(/\/cart/);

  await dialog.getByText("Pick up", { exact: true }).click();
  await dialog.getByPlaceholder("+234 800 000 0000").fill("+2348011111111");
  await dialog.getByRole("button", { name: /^Pay/ }).click();

  await page.waitForURL(/127\.0\.0\.1:5199\/pay\//);
  await expect(page.locator("#mock-paystack")).toBeVisible();
  const reference = (await page.locator("#ref").textContent())!.trim();
  expect(reference.length).toBeGreaterThan(5);

  // Stock is held for the buyer while they pay.
  const vendor = await apiAs("vendor");
  const held = (await myItems(vendor, NAME)).find((i) => i.sku === ALPHA.sku)!;
  expect(held.quantity).toBe(ALPHA.qty - 1);

  // Returning before paying shows the payment as still pending.
  await page.goto(`/checkout/complete?reference=${reference}`);
  await expect(page.getByRole("heading", { name: "Confirming your payment…" })).toBeVisible();

  // The buyer pays on Paystack and is sent back.
  await payOnMockPaystack(reference);
  await expect(page.getByRole("heading", { name: "Payment received" })).toBeVisible({ timeout: 20_000 });
  // Both brands, one payment, and the brand is recorded against each line.
  await expect(page.getByText(`1 × ${NAME} · Alpha Labs`)).toBeVisible();
  await expect(page.getByText(`1 × ${NAME} · Beta Pharma`)).toBeVisible();
  await expect(page.getByText("₦3,300")).toBeVisible();
  await expect(page.getByText("Citadel Pharmacy")).toBeVisible();
  await expect(page.getByText("Pickup. The vendor will contact you when it's ready.")).toBeVisible();
  await expect(page.getByText("ORD-", { exact: false }).first()).toBeVisible();
});

test("a paid order leaves the cart, shows in My orders, and is deducted from stock", async () => {
  await page.goto("/cart");
  await expect(page.getByText("Your cart is empty.")).toBeVisible();

  await page.goto("/orders");
  await expect(page.locator('[data-testid^="purchase-"]').first()).toContainText(NAME);
  await expect(page.locator('[data-testid^="purchase-"]').first()).toContainText("Citadel Pharmacy");

  const vendor = await apiAs("vendor");
  const items = await myItems(vendor, NAME);
  expect(items.find((i) => i.sku === ALPHA.sku)!.quantity).toBe(ALPHA.qty - 1);
  expect(items.find((i) => i.sku === BETA.sku)!.quantity).toBe(BETA.qty - 1);
});

test("an unpaid checkout is rejected for stock the vendor no longer has", async () => {
  const buyer = await apiAs("buyer");
  const res = await buyer.post("checkout", {
    data: { items: [{ inventoryItemId: beta.id, quantity: 5 }], fulfilment: "PICKUP", buyerPhone: "+2348011111111" },
  });
  expect(res.status()).toBeGreaterThanOrEqual(400);
  expect(res.status()).toBeLessThan(500);
});

test("Buy now straight from the search result opens checkout for that exact product", async () => {
  await openSearch(page, NAME);
  await page.getByTestId(`search-buy-${alpha.id}`).click();
  const dialog = page.getByTestId("checkout-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(NAME);
  await expect(dialog).toContainText("Alpha Labs");
  await expect(dialog.getByTestId("checkout-total")).toContainText("1,500");
  await dialog.getByRole("button", { name: "More" }).click();
  await expect(dialog.getByTestId("checkout-total")).toContainText("3,000");
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
});

test("the vendor sees the paid order with both brands, then fulfils it", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: ".auth/vendor.json" });
  const v = await ctx.newPage();
  await v.goto("/vendor/orders");
  await expect(v.getByRole("heading", { name: "Orders" })).toBeVisible();
  const order = v.locator("div.rounded-2xl").filter({ hasText: NAME }).filter({ hasText: "Paid online" }).first();
  await expect(order).toBeVisible();
  await order.getByRole("button").first().click();
  // The vendor sees exactly which brand was bought, and how the buyer wants to receive it.
  await expect(order).toContainText("Alpha Labs");
  await expect(order).toContainText("Beta Pharma");
  await expect(order).toContainText("Buyer picks up from you");
  await expect(order).toContainText("+2348011111111");
  await expect(order).toContainText("₦3,300");

  // A paid order arrives pending: the vendor accepts it, then fulfils it.
  await expect(order).toContainText("Pending");
  await order.getByRole("button", { name: "Accept Order" }).click();
  await expect(v.getByText(/is now processing/i)).toBeVisible();
  await order.getByRole("button", { name: "Mark as Fulfilled" }).click();
  await expect(v.getByText(/is now completed/i)).toBeVisible();
  await ctx.close();

  const api = await apiAs("vendor");
  const orders = await apiData<{ status: string; items: { name: string }[] }[]>(await api.get("orders?limit=50"));
  expect(orders.find((o) => o.items.some((i) => i.name === NAME))!.status).toBe("FULFILLED");
});
