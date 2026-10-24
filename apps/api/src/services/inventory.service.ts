import type { InventoryStatus, Prisma } from "@prisma/client";
import type { CreateInventoryItemInput, UpdateInventoryItemInput } from "@finder/shared";
import { notFound } from "../lib/errors";
import { assertOwnImageUrl } from "../lib/storage";
import { readPreferences } from "./preferences.service";
import { findImage, loadImageIndex, rememberItemImage } from "./image.service";
import { prisma } from "../lib/prisma";
import { decimalToNumber, toIso } from "../lib/serialize";

/**
 * Stock status is derived from quantity rather than trusted from the client,
 * so the network never advertises "in stock" on an empty shelf. DISCONTINUED
 * is the one status a vendor sets by hand, and it sticks until they clear it.
 */
export function deriveStatus(
  quantity: number,
  lowStockThreshold: number,
  requested?: InventoryStatus | null,
): InventoryStatus {
  if (requested === "DISCONTINUED") return "DISCONTINUED";
  if (quantity <= 0) return "OUT_OF_STOCK";
  if (quantity <= lowStockThreshold) return "LOW_STOCK";
  return "IN_STOCK";
}

export const inventoryInclude = {
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.InventoryItemInclude;

type InventoryRow = Prisma.InventoryItemGetPayload<{
  include: typeof inventoryInclude;
}>;

export function serializeInventoryItem(row: InventoryRow) {
  return {
    id: row.id,
    vendorId: row.vendorId,
    productId: row.productId,
    name: row.name,
    sku: row.sku,
    quantity: row.quantity,
    unit: row.unit,
    price: decimalToNumber(row.price),
    currency: row.currency,
    lowStockThreshold: row.lowStockThreshold,
    status: row.status,
    imageUrl: row.imageUrl,
    brand: row.brand,
    description: row.description,
    notes: row.notes,
    category: row.category,
    lastSyncedAt: toIso(row.lastSyncedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type SyncRow = {
  sku: string;
  quantity: number;
  price?: number;
  name?: string;
  brand?: string;
  description?: string;
  /** File name of a photo in the vendor's library. */
  image?: string;
};

export type SyncResult = {
  jobId: string;
  total: number;
  updated: number;
  created: number;
  failed: number;
  /** Products that got a library photo during this run. */
  imagesMatched: number;
  errors: { sku: string; message: string }[];
};

/**
 * Bulk upsert by SKU. Backs both the dashboard's spreadsheet import and the
 * key-authenticated POST /v1/inventory/sync. Existing SKUs get new quantity
 * (and price, when supplied); unknown SKUs are created only when the row
 * carries a name, since a bare SKU is not enough to list something.
 */
export async function syncInventory(
  vendorId: string,
  rows: SyncRow[],
  source: "MANUAL" | "BULK_IMPORT" | "API",
): Promise<SyncResult> {
  const job = await prisma.inventorySyncJob.create({
    data: { vendorId, source, totalItems: rows.length },
  });

  const existing = await prisma.inventoryItem.findMany({
    where: { vendorId, sku: { in: rows.map((r) => r.sku) } },
    select: { id: true, sku: true, name: true, brand: true, imageUrl: true, lowStockThreshold: true, status: true },
  });
  const images = await loadImageIndex(vendorId);
  let imagesMatched = 0;
  const bySku = new Map(existing.map((e) => [e.sku, e]));
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { preferences: true } });
  const { defaults } = readPreferences(vendor?.preferences);

  let updated = 0;
  let created = 0;
  const errors: SyncResult["errors"] = [];
  const now = new Date();

  for (const row of rows) {
    try {
      const match = bySku.get(row.sku);
      if (match) {
        await prisma.inventoryItem.update({
          where: { id: match.id },
          data: {
            quantity: row.quantity,
            ...(row.price !== undefined ? { price: row.price } : {}),
            ...(row.brand ? { brand: row.brand } : {}),
            ...(row.description ? { description: row.description } : {}),
            // A photo the vendor already chose is never replaced by an import.
            ...(match.imageUrl ? {} : imageUpdate(images, { sku: match.sku, name: match.name, brand: row.brand ?? match.brand }, row.image)),
            status: deriveStatus(row.quantity, match.lowStockThreshold, match.status),
            lastSyncedAt: now,
          },
        });
        if (!match.imageUrl && findImage(images, { sku: match.sku, name: match.name, brand: row.brand ?? match.brand }, row.image)) {
          imagesMatched += 1;
        }
        updated += 1;
      } else if (row.name) {
        const imageUrl = findImage(images, { sku: row.sku, name: row.name, brand: row.brand ?? null }, row.image);
        if (imageUrl) imagesMatched += 1;
        await prisma.inventoryItem.create({
          data: {
            vendorId,
            sku: row.sku,
            name: row.name,
            brand: row.brand || null,
            description: row.description || null,
            imageUrl,
            quantity: row.quantity,
            price: row.price ?? 0,
            currency: defaults.currency,
            lowStockThreshold: defaults.lowStockThreshold,
            status: deriveStatus(row.quantity, defaults.lowStockThreshold),
            lastSyncedAt: now,
          },
        });
        created += 1;
      } else {
        errors.push({
          sku: row.sku,
          message: "Unknown SKU — include a name to create it",
        });
      }
    } catch (err) {
      errors.push({
        sku: row.sku,
        message: err instanceof Error ? err.message : "Could not save row",
      });
    }
  }

  await prisma.inventorySyncJob.update({
    where: { id: job.id },
    data: {
      updatedItems: updated,
      createdItems: created,
      failedItems: errors.length,
      errorLog: errors.length ? errors : undefined,
      finishedAt: new Date(),
    },
  });

  return {
    jobId: job.id,
    total: rows.length,
    updated,
    created,
    failed: errors.length,
    imagesMatched,
    errors,
  };
}

/** The imageUrl patch for an existing product, or nothing when the library has no match. */
function imageUpdate(index: Awaited<ReturnType<typeof loadImageIndex>>, item: { sku: string | null; name: string; brand: string | null }, file?: string) {
  const imageUrl = findImage(index, item, file);
  return imageUrl ? { imageUrl } : {};
}

/**
 * Create one listing. `sent` is the body as the client sent it, before Zod
 * filled defaults — a threshold or currency the client did not send falls back
 * to the vendor's own defaults from Settings → Preferences.
 */
export async function createInventoryItem(
  vendorId: string,
  input: CreateInventoryItemInput,
  sent: Record<string, unknown>,
) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { preferences: true },
  });
  const { defaults } = readPreferences(vendor?.preferences);
  const lowStockThreshold = "lowStockThreshold" in sent ? input.lowStockThreshold : defaults.lowStockThreshold;
  const currency = "currency" in sent ? input.currency : defaults.currency;

  assertOwnImageUrl(vendorId, input.imageUrl);

  const item = await prisma.inventoryItem.create({
    data: {
      vendorId,
      productId: input.productId ?? null,
      categoryId: input.categoryId ?? null,
      name: input.name,
      sku: input.sku || null,
      quantity: input.quantity,
      unit: input.unit,
      price: input.price,
      currency,
      lowStockThreshold,
      status: deriveStatus(input.quantity, lowStockThreshold, input.status),
      imageUrl: input.imageUrl ?? null,
      brand: input.brand || null,
      description: input.description || null,
      notes: input.notes ?? null,
      lastSyncedAt: new Date(),
    },
    include: inventoryInclude,
  });
  await rememberItemImage(vendorId, item, item.imageUrl);
  return serializeInventoryItem(item);
}

/** Loads one of this vendor's items, or 404s — never another vendor's. */
export async function findOwnItem(vendorId: string, id: string) {
  const item = await prisma.inventoryItem.findFirst({
    where: { id, vendorId },
    include: inventoryInclude,
  });
  if (!item) throw notFound("No such inventory item");
  return item;
}

export async function updateInventoryItem(
  vendorId: string,
  id: string,
  input: UpdateInventoryItemInput,
) {
  assertOwnImageUrl(vendorId, input.imageUrl);
  const current = await findOwnItem(vendorId, id);
  const quantity = input.quantity ?? current.quantity;
  const threshold = input.lowStockThreshold ?? current.lowStockThreshold;
  // An explicit status only matters for DISCONTINUED; otherwise re-derive, and
  // clearing DISCONTINUED means sending any other status.
  const requested =
    input.status ?? (current.status === "DISCONTINUED" ? "DISCONTINUED" : null);

  const item = await prisma.inventoryItem.update({
    where: { id: current.id },
    data: {
      name: input.name,
      sku: input.sku === undefined ? undefined : input.sku || null,
      categoryId: input.categoryId,
      productId: input.productId,
      quantity: input.quantity,
      unit: input.unit,
      price: input.price,
      currency: input.currency,
      lowStockThreshold: input.lowStockThreshold,
      imageUrl: input.imageUrl,
      brand: input.brand === undefined ? undefined : input.brand || null,
      description: input.description === undefined ? undefined : input.description || null,
      notes: input.notes,
      status: deriveStatus(quantity, threshold, requested),
      ...(input.quantity !== undefined ? { lastSyncedAt: new Date() } : {}),
    },
    include: inventoryInclude,
  });
  // Remember a newly chosen photo; clearing one leaves the library untouched.
  if (input.imageUrl) await rememberItemImage(vendorId, item, item.imageUrl);
  return serializeInventoryItem(item);
}

export async function deleteInventoryItem(vendorId: string, id: string): Promise<void> {
  const current = await findOwnItem(vendorId, id);
  // Order lines keep their denormalised name/price, so deleting is safe.
  await prisma.inventoryItem.delete({ where: { id: current.id } });
}
