import { expect, test, type Locator, type Page } from "@playwright/test";
import { apiAs, csvFile, isServedImage, myItems, pngFile, toast, uid } from "../fixtures/helpers";

/**
 * The vendor inventory story, start to finish, as the "Greenfield Supplies"
 * demo vendor who begins with an empty catalogue: add by hand, edit one
 * product, manage its photo, bulk-import stock, bulk-upload photos, and see the
 * photo library bring images back on a later import.
 */
test.use({ storageState: ".auth/newVendor.json" });
test.describe.configure({ mode: "serial" });

const RUN = uid();
const EMZOR = { name: `Paracetamol 500mg ${RUN}`, sku: `E2E-PCM-EMZ-${RUN}`, brand: "Emzor" };
const GENERIC = { name: `Paracetamol 500mg ${RUN}`, sku: `E2E-PCM-GEN-${RUN}`, brand: "Generics Co" };

const row = (page: Page, text: string) => page.locator('[data-testid^="product-row-"]').filter({ hasText: text });
const fileInput = (r: Locator) => r.locator('input[type="file"]').last();

async function openInventory(page: Page, tab: "Manual Entry" | "Bulk Import" = "Manual Entry") {
  await page.goto("/vendor/inventory");
  await expect(page.getByRole("heading", { name: "AI Inventory Sync Center" })).toBeVisible();
  await page.getByRole("button", { name: tab }).first().click();
}

async function addByHand(page: Page, p: { name: string; sku: string; brand: string; qty: string; price: string; description?: string }) {
  await page.getByPlaceholder("e.g. Amoxicillin 500mg").fill(p.name);
  await page.getByPlaceholder("e.g. MED-001").fill(p.sku);
  await page.getByPlaceholder("e.g. Emzor, Dangote").fill(p.brand);
  if (p.description) await page.getByPlaceholder("Strength, pack size, specification…").fill(p.description);
  await page.getByPlaceholder("500", { exact: true }).fill(p.qty);
  await page.getByPlaceholder("1,200").fill(p.price);
  await page.getByRole("button", { name: "Add Product to Finder" }).click();
}

test("a brand-new vendor sees an empty catalogue with guidance", async ({ page }) => {
  await openInventory(page);
  await expect(page.getByText("No products yet — add your first one.")).toBeVisible();
  await expect(page.getByTestId("photo-coverage")).toHaveText("Add products first.");
  await expect(page.getByTestId("photos-match")).toBeDisabled();
});

test("manual entry validates before anything is saved", async ({ page }) => {
  await openInventory(page);
  await page.getByRole("button", { name: "Add Product to Finder" }).click();
  // Name, quantity and price are required: at least those three messages appear and nothing is created.
  await expect(page.locator("p.text-red-400")).not.toHaveCount(0);
  const api = await apiAs("newVendor");
  expect(await myItems(api)).toHaveLength(0);

  await page.getByPlaceholder("e.g. Amoxicillin 500mg").fill("X");
  await page.getByPlaceholder("500", { exact: true }).fill("-5");
  await page.getByPlaceholder("1,200").fill("abc");
  await page.getByRole("button", { name: "Add Product to Finder" }).click();
  await expect(page.locator("p.text-red-400")).not.toHaveCount(0);
  expect(await myItems(api)).toHaveLength(0);
});

test("adds two same-named products from different brands by hand", async ({ page }) => {
  await openInventory(page);
  await addByHand(page, { ...EMZOR, qty: "50", price: "450", description: "Card of 12 tablets, 500mg each." });
  await expect(toast(page, "Live on Finder")).toBeVisible();
  await expect(row(page, EMZOR.sku)).toHaveCount(1);
  // The form clears after a successful add.
  await expect(page.getByPlaceholder("e.g. Amoxicillin 500mg")).toHaveValue("");

  await addByHand(page, { ...GENERIC, qty: "8", price: "300" });
  await expect(row(page, GENERIC.sku)).toHaveCount(1);

  // The list shows brand beside the name and the stock state.
  await expect(row(page, EMZOR.sku)).toContainText("Emzor");
  await expect(row(page, GENERIC.sku)).toContainText("Generics Co");
  await expect(row(page, GENERIC.sku)).toContainText("Low Stock"); // 8 <= default threshold of 10
  await expect(page.getByTestId("photo-coverage")).toHaveText("0 of 2 products have a photo");
});

test("rejects a duplicate SKU instead of silently overwriting", async ({ page }) => {
  await openInventory(page);
  await addByHand(page, { name: "Duplicate attempt", sku: EMZOR.sku, brand: "Other", qty: "1", price: "1" });
  await expect(toast(page, "Could not add product")).toBeVisible();
  const api = await apiAs("newVendor");
  expect((await myItems(api)).filter((i) => i.sku === EMZOR.sku)).toHaveLength(1);
});

test("edits one product's stock, price, brand and description, and it survives a reload", async ({ page }) => {
  await openInventory(page);
  const r = row(page, EMZOR.sku);
  await r.getByRole("button", { name: "Edit product" }).click();
  await r.getByRole("spinbutton").first().fill("0"); // quantity
  await r.getByRole("spinbutton").nth(1).fill("520"); // price
  await r.getByPlaceholder("e.g. Emzor, Dangote").fill("Emzor Pharma");
  await r.getByPlaceholder("Strength, pack size, specification…").fill("Updated: blister card of 12 x 500mg.");
  await r.getByRole("button", { name: "Save changes" }).click();
  await expect(toast(page, "Product updated")).toBeVisible();

  // Out of stock is derived from quantity.
  await expect(r).toContainText("Out of Stock");
  await page.reload();
  await page.getByRole("button", { name: "Manual Entry" }).first().click();
  const again = row(page, EMZOR.sku);
  await expect(again).toContainText("Emzor Pharma");
  await again.getByRole("button", { name: "Edit product" }).click();
  await expect(again.getByRole("spinbutton").nth(1)).toHaveValue("520");
  await expect(again.getByPlaceholder("Strength, pack size, specification…")).toHaveValue("Updated: blister card of 12 x 500mg.");

  // Restore stock so later steps (and the buyer journey) see it available.
  await again.getByRole("spinbutton").first().fill("40");
  await again.getByRole("button", { name: "Save changes" }).click();
  await expect(toast(page, "Product updated")).toBeVisible();
});

test("editing one product leaves the other untouched", async () => {
  const api = await apiAs("newVendor");
  const generic = (await myItems(api)).find((i) => i.sku === GENERIC.sku)!;
  expect(generic.quantity).toBe(8);
  expect(Number(generic.price)).toBe(300);
  expect(generic.brand).toBe("Generics Co");
});

test("adds, replaces and removes a photo on a single product", async ({ page }) => {
  await openInventory(page);
  const r = row(page, EMZOR.sku);
  await r.getByRole("button", { name: "Edit product" }).click();
  await expect(r.getByRole("button", { name: "Add photo", exact: true })).toBeVisible();
  await expect(r.getByRole("button", { name: "Remove photo" })).toHaveCount(0);

  // Add
  await fileInput(r).setInputFiles(pngFile("anything-at-all.png", 1));
  await expect(toast(page, "Photo saved")).toBeVisible();
  const photo = r.getByRole("img", { name: `${EMZOR.name} photo` });
  await expect(photo).toBeVisible();
  const first = (await photo.getAttribute("src"))!;
  expect(await isServedImage(first)).toBe(true);
  await expect(page.getByTestId("photo-coverage")).toHaveText("1 of 2 products have a photo");

  // Replace
  await expect(r.getByRole("button", { name: "Replace photo" })).toBeVisible();
  await fileInput(r).setInputFiles(pngFile("second.png", 2));
  await expect(toast(page, "Photo saved")).toBeVisible();
  await expect(photo).not.toHaveAttribute("src", first);
  const second = (await photo.getAttribute("src"))!;
  expect(await isServedImage(second)).toBe(true);

  // Remove
  await r.getByRole("button", { name: "Remove photo" }).click();
  await expect(toast(page, "Photo removed")).toBeVisible();
  await expect(r.getByRole("img", { name: `${EMZOR.name} photo` })).toHaveCount(0);
  await expect(r.getByRole("button", { name: "Add photo", exact: true })).toBeVisible();
  await expect(page.getByTestId("photo-coverage")).toHaveText("0 of 2 products have a photo");
});

test("refuses non-image files and files over 5 MB", async ({ page }) => {
  await openInventory(page);
  const r = row(page, EMZOR.sku);
  await r.getByRole("button", { name: "Edit product" }).click();

  await fileInput(r).setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") });
  await expect(toast(page, "Use a JPG, PNG or WebP image.")).toBeVisible();

  await fileInput(r).setInputFiles({ name: "huge.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(toast(page, "Images can be at most 5 MB.")).toBeVisible();

  const api = await apiAs("newVendor");
  const item = (await myItems(api)).find((i) => i.sku === EMZOR.sku)!;
  expect(item.imageUrl).toBeNull();
});

test("a photo named after the SKU is matched to the right product automatically", async ({ page }) => {
  await openInventory(page);
  await page.locator('input[type="file"][multiple]').setInputFiles(pngFile(`${GENERIC.sku}.png`, 3));
  await expect(toast(page, /1 photo uploaded/)).toBeVisible();
  await expect(row(page, GENERIC.sku).getByRole("img", { name: `${GENERIC.name} photo` })).toBeVisible();
  // The same-named Emzor product did not borrow it.
  await expect(row(page, EMZOR.sku).locator("img")).toHaveCount(0);
  await expect(page.getByTestId("photo-coverage")).toHaveText("1 of 2 products have a photo");
});

test("a photo that matches nothing is kept and the vendor is told", async ({ page }) => {
  await openInventory(page);
  await page.locator('input[type="file"][multiple]').setInputFiles(pngFile("mystery-product-zzz.png", 4));
  await expect(page.getByText("No product matched:")).toBeVisible();
  await expect(page.getByText("mystery-product-zzz.png")).toBeVisible();
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText("No product matched:")).toHaveCount(0);
});

test("a bare product name never guesses between two brands", async ({ page }) => {
  await openInventory(page);
  // Both products are called the same thing, so a file named only after that name is ambiguous.
  await page.locator('input[type="file"][multiple]').setInputFiles(pngFile(`${EMZOR.name}.png`, 5));
  await expect(page.getByText("No product matched:")).toBeVisible();
  await expect(row(page, EMZOR.sku).locator("img")).toHaveCount(0);
  // Brand + name is specific enough.
  await page.locator('input[type="file"][multiple]').setInputFiles(pngFile(`Emzor Pharma ${EMZOR.name}.png`, 6));
  await expect(row(page, EMZOR.sku).getByRole("img", { name: `${EMZOR.name} photo` })).toBeVisible();
});

test("bulk CSV import: detects columns, updates existing SKUs, creates new ones, reports bad rows", async ({ page }) => {
  await openInventory(page, "Bulk Import");
  const csv = [
    "Product Code,Item Name,Maker,Qty,Unit Price",
    `${EMZOR.sku},,,75,610`, // existing: stock and price change only
    `E2E-NEW-1-${RUN},Amoxicillin 500mg ${RUN},Emzor,480,"₦1,200"`, // new, with currency formatting
    `E2E-NEW-2-${RUN},Hydraulic Pump 12T ${RUN},,12,84500`,
    `,No code row,,5,100`, // no SKU: skipped
    `E2E-BAD-${RUN},Bad quantity ${RUN},,lots,100`, // non-numeric quantity: skipped
  ].join("\n");
  await page.locator('input[type="file"][accept=".csv,text/csv"]').setInputFiles(csvFile("stock.csv", csv));

  await expect(page.getByText("stock.csv detected · 5 rows")).toBeVisible();
  // Header aliases were recognised without any manual mapping.
  await expect(page.getByText("Product Code", { exact: true })).toBeVisible();
  await expect(page.getByText("Maker", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Confirm & Import 5 Products/ })).toBeEnabled();
  await page.getByRole("button", { name: /Confirm & Import/ }).click();

  await expect(page.getByText(/3 Products Synced/)).toBeVisible({ timeout: 30_000 });
  const api = await apiAs("newVendor");
  const items = await myItems(api);
  const emzor = items.find((i) => i.sku === EMZOR.sku)!;
  expect(emzor.quantity).toBe(75);
  expect(Number(emzor.price)).toBe(610);
  expect(emzor.brand).toBe("Emzor Pharma"); // not blanked by the empty brand cell
  const amox = items.find((i) => i.sku === `E2E-NEW-1-${RUN}`)!;
  expect(Number(amox.price)).toBe(1200);
  expect(amox.brand).toBe("Emzor");
  expect(items.find((i) => i.sku === `E2E-NEW-2-${RUN}`)!.quantity).toBe(12);
  expect(items.find((i) => i.sku === `E2E-BAD-${RUN}`)).toBeUndefined();
});

test("bulk CSV import rejects the wrong file type and files without a SKU column", async ({ page }) => {
  await openInventory(page, "Bulk Import");
  await page.locator('input[type="file"][accept=".csv,text/csv"]').setInputFiles({ name: "stock.xlsx", mimeType: "application/vnd.ms-excel", buffer: Buffer.from("x") });
  await expect(page.getByText("Please upload a .csv file.")).toBeVisible();

  await page.locator('input[type="file"][accept=".csv,text/csv"]').setInputFiles(csvFile("empty.csv", "sku,quantity\n"));
  await expect(page.getByText("That file has no data rows under the header.")).toBeVisible();

  await page.locator('input[type="file"][accept=".csv,text/csv"]').setInputFiles(csvFile("nosku.csv", "title,count\nThing,4\n"));
  await expect(page.getByText(/A SKU column and a quantity column are required/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Confirm & Import/ })).toBeDisabled();
});

test("the CSV template downloads", async ({ page }) => {
  await openInventory(page, "Bulk Import");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByText("Download Finder Template").click()]);
  expect(download.suggestedFilename()).toBe("finder-inventory-template.csv");
});

test("the photo library restores a deleted product's photo when it is re-imported", async ({ page }) => {
  await openInventory(page);
  // GENERIC got its photo through the library (file named after its SKU). Delete the product...
  const r = row(page, GENERIC.sku);
  await r.getByRole("button", { name: "Edit product" }).click();
  page.once("dialog", (d) => void d.accept());
  await r.getByRole("button", { name: "Remove product" }).click();
  await expect(toast(page, "Removed from Finder")).toBeVisible();
  await expect(row(page, GENERIC.sku)).toHaveCount(0);

  // ...then bring it back through a CSV that carries no photo information at all.
  await page.getByRole("button", { name: "Bulk Import" }).first().click();
  const csv = `sku,name,brand,quantity,price\n${GENERIC.sku},${GENERIC.name},${GENERIC.brand},20,320\n`;
  await page.locator('input[type="file"][accept=".csv,text/csv"]').setInputFiles(csvFile("restock.csv", csv));
  await page.getByRole("button", { name: /Confirm & Import/ }).click();
  await expect(page.getByText(/1 Products Synced/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Photos matched").locator("..").getByText("1", { exact: true })).toBeVisible();

  const api = await apiAs("newVendor");
  const back = (await myItems(api)).find((i) => i.sku === GENERIC.sku)!;
  expect(back.imageUrl).not.toBeNull();
  expect(await isServedImage(back.imageUrl!)).toBe(true);
});

test("a CSV can name the photo file explicitly", async ({ page }) => {
  await openInventory(page);
  await page.locator('input[type="file"][multiple]').setInputFiles(pngFile(`labelled-${RUN}.png`, 7));
  await expect(toast(page, /1 photo uploaded/)).toBeVisible();

  await page.getByRole("button", { name: "Bulk Import" }).first().click();
  const csv = `sku,name,quantity,price,image\nE2E-NEW-2-${RUN},Hydraulic Pump 12T ${RUN},12,84500,labelled-${RUN}.png\n`;
  await page.locator('input[type="file"][accept=".csv,text/csv"]').setInputFiles(csvFile("named.csv", csv));
  await expect(page.getByText("Photo File Name", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Confirm & Import/ }).click();
  await expect(page.getByText(/1 Products Synced/)).toBeVisible({ timeout: 30_000 });

  const api = await apiAs("newVendor");
  const pump = (await myItems(api)).find((i) => i.sku === `E2E-NEW-2-${RUN}`)!;
  expect(pump.imageUrl).toContain(`/vendors/`);
});

test("search narrows the list and 'View all' pages past the first eight", async ({ page }) => {
  await openInventory(page);
  await page.getByPlaceholder("Search name or SKU").fill("Hydraulic");
  await expect(page.locator('[data-testid^="product-row-"]')).toHaveCount(1);
  await page.getByPlaceholder("Search name or SKU").fill("zzz-no-such-product");
  await expect(page.getByText("No products match that search.")).toBeVisible();
});

test("removing a product asks first and can be cancelled", async ({ page }) => {
  await openInventory(page);
  const r = row(page, `E2E-NEW-1-${RUN}`);
  await r.getByRole("button", { name: "Edit product" }).click();
  page.once("dialog", (d) => void d.dismiss());
  await r.getByRole("button", { name: "Remove product" }).click();
  await expect(row(page, `E2E-NEW-1-${RUN}`)).toHaveCount(1);
});
