import { beforeEach, describe, expect, it } from "vitest";
import { env } from "../src/env";
import { prisma } from "../src/lib/prisma";
import { fileKey, itemKeys, normalizeKey } from "../src/lib/image-keys";
import { createInventoryItem, syncInventory, updateInventoryItem } from "../src/services/inventory.service";
import { getDiscoverItem, runDiscover } from "../src/services/discover.service";
import { matchLibraryToItems, registerImages } from "../src/services/image.service";
import { mergePreferences, readPreferences } from "../src/services/preferences.service";
import { discoverQuerySchema } from "@finder/shared";
import { makeItem, makeVendor, resetDb } from "./factories";

const storage = env.storage as { bucket: string; accessKeyId: string; secretAccessKey: string; publicUrl: string; endpoint: string };
const PUBLIC = "https://cdn.test";
const photo = (vendorId: string, name: string) => `${PUBLIC}/vendors/${vendorId}/product/${name}`;

beforeEach(async () => {
  await resetDb();
  Object.assign(storage, { bucket: "finder-test", accessKeyId: "AKIATEST", secretAccessKey: "secret", publicUrl: PUBLIC, endpoint: "https://acct.r2.test" });
});

describe("match keys", () => {
  it("make file names, SKUs and names comparable", () => {
    expect(fileKey("MED-001.jpg")).toBe("med001");
    expect(fileKey("Med_001.PNG")).toBe("med001");
    expect(normalizeKey("Amoxicillin 500mg")).toBe("amoxicillin500mg");
    expect(itemKeys({ sku: "MED-001", name: "Amoxicillin 500mg", brand: "Emzor" })).toEqual({
      strong: ["med001", "emzoramoxicillin500mg", "amoxicillin500mgemzor"],
      nameOnly: "amoxicillin500mg",
    });
  });
});

describe("registerImages", () => {
  it("attaches each photo to the product its file name points at", async () => {
    const v = await makeVendor();
    const bySku = await makeItem(v.id, { sku: "MED-001", name: "Amoxicillin" });
    const byName = await makeItem(v.id, { sku: "X1", name: "Hydraulic Pump 12T" });
    const other = await makeItem(v.id, { sku: "X2", name: "Welding Rod" });

    const result = await registerImages(v.id, [
      { url: photo(v.id, "1.jpg"), fileName: "med-001.jpg" },
      { url: photo(v.id, "2.jpg"), fileName: "Hydraulic pump 12T.png" },
      { url: photo(v.id, "3.jpg"), fileName: "unknown-thing.jpg" },
    ]);

    expect(result.matched).toBe(2);
    expect(result.unmatched).toEqual(["unknown-thing.jpg"]);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: bySku.id } })).imageUrl).toBe(photo(v.id, "1.jpg"));
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: byName.id } })).imageUrl).toBe(photo(v.id, "2.jpg"));
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: other.id } })).imageUrl).toBeNull();
  });

  it("never gives one brand a photo meant for another brand of the same name", async () => {
    const v = await makeVendor();
    const emzor = await makeItem(v.id, { sku: "P-E", name: "Paracetamol 500mg", brand: "Emzor" });
    const fidson = await makeItem(v.id, { sku: "P-F", name: "Paracetamol 500mg", brand: "Fidson" });

    await registerImages(v.id, [{ url: photo(v.id, "p.jpg"), fileName: "Paracetamol 500mg.jpg" }]);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: emzor.id } })).imageUrl).toBeNull();
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fidson.id } })).imageUrl).toBeNull();

    // Naming the file after the brand, or the SKU, is unambiguous.
    await registerImages(v.id, [{ url: photo(v.id, "pf.jpg"), fileName: "Fidson Paracetamol 500mg.jpg" }]);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fidson.id } })).imageUrl).toBe(photo(v.id, "pf.jpg"));
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: emzor.id } })).imageUrl).toBeNull();
  });

  it("leaves a photo the vendor already chose alone", async () => {
    const v = await makeVendor();
    const item = await makeItem(v.id, { sku: "MED-001", imageUrl: photo(v.id, "mine.jpg") });
    const result = await registerImages(v.id, [{ url: photo(v.id, "new.jpg"), fileName: "MED-001.jpg" }]);
    expect(result.matched).toBe(0);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).imageUrl).toBe(photo(v.id, "mine.jpg"));
  });

  it("refuses photos that are not the vendor's own uploads", async () => {
    const [mine, theirs] = [await makeVendor(), await makeVendor()];
    await expect(registerImages(mine.id, [{ url: photo(theirs.id, "x.jpg"), fileName: "x.jpg" }])).rejects.toMatchObject({ status: 400 });
    expect(await prisma.vendorImage.count()).toBe(0);
  });
});

describe("the library remembers photos", () => {
  it("restores a photo when a deleted product is imported again", async () => {
    const v = await makeVendor();
    const base = { name: "Welding Rod", quantity: 5, unit: "box", price: 900, currency: "NGN", lowStockThreshold: 2 } as const;
    const created = await createInventoryItem(v.id, { ...base, sku: "WLD-1", imageUrl: photo(v.id, "rod.jpg") } as never, {});
    await prisma.inventoryItem.delete({ where: { id: created.id } });

    const result = await syncInventory(v.id, [{ sku: "WLD-1", name: "Welding Rod", quantity: 7, price: 950 }], "BULK_IMPORT");

    expect(result).toMatchObject({ created: 1, imagesMatched: 1 });
    expect((await prisma.inventoryItem.findFirstOrThrow({ where: { vendorId: v.id } })).imageUrl).toBe(photo(v.id, "rod.jpg"));
  });

  it("fills photos and details on import from the CSV image column", async () => {
    const v = await makeVendor();
    await registerImages(v.id, [{ url: photo(v.id, "a.jpg"), fileName: "front-view.jpg" }]);

    const result = await syncInventory(
      v.id,
      [{ sku: "N1", name: "Safety Boots", quantity: 3, brand: "Dunlop", description: "Steel toe", image: "Front-View.jpg" }],
      "BULK_IMPORT",
    );

    expect(result.imagesMatched).toBe(1);
    expect(await prisma.inventoryItem.findFirstOrThrow({ where: { sku: "N1" } })).toMatchObject({
      brand: "Dunlop",
      description: "Steel toe",
      imageUrl: photo(v.id, "a.jpg"),
    });
  });

  it("does not replace a photo the vendor set when stock is re-imported", async () => {
    const v = await makeVendor();
    const item = await makeItem(v.id, { sku: "S1", name: "Gloves", imageUrl: photo(v.id, "mine.jpg") });
    await registerImages(v.id, [{ url: photo(v.id, "other.jpg"), fileName: "S1.jpg" }]);
    await syncInventory(v.id, [{ sku: "S1", quantity: 9 }], "BULK_IMPORT");
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).imageUrl).toBe(photo(v.id, "mine.jpg"));
  });

  it("remembers a photo added by hand and re-applies it on the match-images click", async () => {
    const v = await makeVendor();
    const item = await makeItem(v.id, { sku: "G1", name: "Gas Cylinder 12.5kg" });
    await updateInventoryItem(v.id, item.id, { imageUrl: photo(v.id, "gas.jpg") });
    await updateInventoryItem(v.id, item.id, { imageUrl: null }); // vendor removes it

    const result = await matchLibraryToItems(v.id);

    expect(result.matched).toBe(1);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).imageUrl).toBe(photo(v.id, "gas.jpg"));
  });

  it("keeps libraries separate between vendors", async () => {
    const [a, b] = [await makeVendor(), await makeVendor()];
    await registerImages(a.id, [{ url: photo(a.id, "x.jpg"), fileName: "SAME-SKU.jpg" }]);
    const theirs = await makeItem(b.id, { sku: "SAME-SKU" });
    expect((await matchLibraryToItems(b.id)).matched).toBe(0);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: theirs.id } })).imageUrl).toBeNull();
  });
});

describe("product page", () => {
  it("returns photo, brand and description for a listing", async () => {
    const v = await makeVendor();
    const item = await makeItem(v.id, { name: "Amoxicillin 500mg", brand: "Emzor", imageUrl: photo(v.id, "a.jpg") });
    await prisma.inventoryItem.update({ where: { id: item.id }, data: { description: "Capsules, pack of 20" } });

    expect(await getDiscoverItem(item.id, null)).toMatchObject({
      inventoryItemId: item.id,
      brand: "Emzor",
      description: "Capsules, pack of 20",
      imageUrl: photo(v.id, "a.jpg"),
      vendor: { id: v.id },
    });
  });

  it("404s for hidden vendors and discontinued products", async () => {
    const paused = await makeVendor({ listingPaused: true });
    const pending = await makeVendor({ status: "PENDING" });
    const live = await makeVendor();
    const gone = await makeItem(live.id);
    await prisma.inventoryItem.update({ where: { id: gone.id }, data: { status: "DISCONTINUED" } });

    for (const id of [(await makeItem(paused.id)).id, (await makeItem(pending.id)).id, gone.id, "nope"]) {
      await expect(getDiscoverItem(id, null)).rejects.toMatchObject({ status: 404 });
    }
  });

  it("is found by brand in search", async () => {
    const v = await makeVendor();
    await makeItem(v.id, { name: "Paracetamol", brand: "Emzor" });
    await makeItem(v.id, { name: "Paracetamol", brand: "Fidson" });
    const { rows } = await runDiscover(discoverQuerySchema.parse({ q: "paracetamol emzor" }), null);
    expect(rows.map((r) => r.brand)).toEqual(["Emzor"]);
  });
});

describe("vendor privacy controls", () => {
  it("are inert: stored choices are ignored and new ones are not saved", () => {
    const stored = { privacy: { showPricing: false, showQuantities: false } };
    expect(readPreferences(stored).privacy).toMatchObject({ showPricing: true, showQuantities: true });

    const merged = mergePreferences(stored, { privacy: { showPricing: true }, notifications: { marketing: true } });
    // The earlier choice survives untouched, ready for when the controls return.
    expect(merged.privacy.showPricing).toBe(false);
    expect(merged.notifications.marketing).toBe(true);
  });

  it("show a price to buyers even if the vendor once hid it", async () => {
    const v = await makeVendor();
    await prisma.vendor.update({ where: { id: v.id }, data: { preferences: { privacy: { showPricing: false, showQuantities: false } } } });
    const item = await makeItem(v.id, { price: 750, quantity: 4 });
    expect(await getDiscoverItem(item.id, null)).toMatchObject({ price: 750, quantity: 4 });
  });
});
