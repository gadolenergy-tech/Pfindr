import { prisma } from "../lib/prisma";
import { assertOwnImageUrl } from "../lib/storage";
import { fileKey, itemKeys, normalizeKey } from "../lib/image-keys";
import type { ImageMatchResult } from "@finder/shared";

type ItemLike = { sku: string | null; name: string; brand: string | null };

/** A vendor's photo library, indexed for matching. */
export type ImageIndex = {
  byKey: Map<string, string>;
  byFileName: Map<string, string>;
  /** How many of the vendor's products share each bare name. */
  nameCounts: Map<string, number>;
};

export async function loadImageIndex(vendorId: string): Promise<ImageIndex> {
  const [images, items] = await Promise.all([
    prisma.vendorImage.findMany({ where: { vendorId }, orderBy: { createdAt: "asc" } }),
    prisma.inventoryItem.findMany({ where: { vendorId }, select: { name: true } }),
  ]);
  const byKey = new Map<string, string>();
  const byFileName = new Map<string, string>();
  // Oldest first, so the newest upload wins a clash.
  for (const image of images) {
    for (const key of image.keys) byKey.set(key, image.url);
    byFileName.set(image.fileName.toLowerCase(), image.url);
  }
  const nameCounts = new Map<string, number>();
  for (const { name } of items) {
    const key = normalizeKey(name);
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }
  return { byKey, byFileName, nameCounts };
}

/**
 * The library photo for a product, or null. An explicit file name (the CSV
 * `image` column) wins, then SKU / brand+name, and the bare name only when no
 * other product of the vendor's shares it, so one brand never borrows another's
 * photo.
 */
export function findImage(index: ImageIndex, item: ItemLike, fileName?: string | null): string | null {
  if (fileName) {
    const named = index.byFileName.get(fileName.trim().toLowerCase()) ?? index.byKey.get(fileKey(fileName));
    if (named) return named;
  }
  const { strong, nameOnly } = itemKeys(item);
  for (const key of strong) {
    const url = index.byKey.get(key);
    if (url) return url;
  }
  if (nameOnly && (index.nameCounts.get(nameOnly) ?? 0) <= 1) return index.byKey.get(nameOnly) ?? null;
  return null;
}

/**
 * Remembers the photo a vendor attached to a product under that product's SKU
 * and name, so it comes back after the row is deleted and re-imported.
 */
export async function rememberItemImage(vendorId: string, item: ItemLike, url: string | null | undefined) {
  if (!url) return;
  const { strong, nameOnly } = itemKeys(item);
  const keys = [...new Set([...strong, nameOnly].filter(Boolean))];
  if (keys.length === 0) return;
  await prisma.vendorImage.upsert({
    where: { vendorId_url: { vendorId, url } },
    create: { vendorId, url, fileName: item.sku || item.name, keys },
    update: { keys: { set: keys } },
  });
}

/** Adds freshly uploaded photos to the library, then matches them to products. */
export async function registerImages(vendorId: string, images: { url: string; fileName: string }[]) {
  for (const { url } of images) assertOwnImageUrl(vendorId, url);
  for (const { url, fileName } of images) {
    const key = fileKey(fileName);
    await prisma.vendorImage.upsert({
      where: { vendorId_url: { vendorId, url } },
      create: { vendorId, url, fileName, keys: key ? [key] : [] },
      update: { fileName, keys: { set: key ? [key] : [] } },
    });
  }
  return matchLibraryToItems(vendorId);
}

/**
 * Gives every product without a photo the one its library entry matches.
 * Products that already have a photo are left alone — the vendor chose it.
 */
export async function matchLibraryToItems(vendorId: string): Promise<ImageMatchResult> {
  const index = await loadImageIndex(vendorId);
  const [bare, library] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { vendorId, imageUrl: null },
      select: { id: true, sku: true, name: true, brand: true },
    }),
    prisma.vendorImage.findMany({ where: { vendorId }, select: { url: true, fileName: true } }),
  ]);

  const used = new Set<string>();
  let matched = 0;
  for (const item of bare) {
    const url = findImage(index, item);
    if (!url) continue;
    await prisma.inventoryItem.update({ where: { id: item.id }, data: { imageUrl: url } });
    used.add(url);
    matched += 1;
  }

  // A photo is "unmatched" if no product of the vendor's wears it.
  const worn = new Set(
    (await prisma.inventoryItem.findMany({ where: { vendorId, imageUrl: { not: null } }, select: { imageUrl: true } })).map(
      (i) => i.imageUrl,
    ),
  );
  const unmatched = library.filter((l) => !worn.has(l.url) && !used.has(l.url)).map((l) => l.fileName);
  return { matched, unmatched };
}
