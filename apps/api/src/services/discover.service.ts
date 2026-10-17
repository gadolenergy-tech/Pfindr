import type { Prisma } from "@prisma/client";
import type { DiscoverQuery } from "@finder/shared";
import { prisma } from "../lib/prisma";
import { decimalToNumber } from "../lib/serialize";
import { logger } from "../lib/logger";
import { recordImpressions } from "./stats.service";
import { readPreferences } from "./preferences.service";

/** Great-circle distance in kilometres. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Cap on rows pulled before distance filtering. Distance cannot be expressed
 * in a Prisma where clause without PostGIS, so candidates are narrowed by text,
 * category, city and price in SQL, then ranked by distance in memory.
 * Revisit with PostGIS once the catalogue outgrows this.
 */
const CANDIDATE_LIMIT = 500;

/**
 * The public discovery query: what is in stock, how much, at what price, and
 * from the nearest verified vendor. No auth required; a signed-in caller is
 * attributed in the search log.
 */
export async function runDiscover(query: DiscoverQuery, userId: string | null) {
  const {
    q,
    page,
    limit,
    categorySlug,
    city,
    state,
    latitude,
    longitude,
    radiusKm,
    minPrice,
    maxPrice,
    inStockOnly,
    sort,
  } = query;

  const terms = q.trim().split(/\s+/).filter((t) => t.length > 1).slice(0, 6);

  const category = categorySlug
    ? await prisma.category.findUnique({
        where: { slug: categorySlug },
        select: { id: true },
      })
    : null;

  const where: Prisma.InventoryItemWhereInput = {
    vendor: {
      status: "VERIFIED",
      listingPaused: false,
      ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
      ...(state ? { state: { equals: state, mode: "insensitive" } } : {}),
    },
    ...(inStockOnly
      ? { status: { in: ["IN_STOCK", "LOW_STOCK"] }, quantity: { gt: 0 } }
      : { status: { not: "DISCONTINUED" } }),
    ...(category ? { categoryId: category.id } : {}),
    ...(minPrice !== undefined || maxPrice !== undefined
      ? {
          price: {
            ...(minPrice !== undefined ? { gte: minPrice } : {}),
            ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
          },
        }
      : {}),
    // Every term must appear in the name, SKU or category name.
    AND: (terms.length ? terms : [q.trim()]).map((term) => ({
      OR: [
        { name: { contains: term, mode: "insensitive" as const } },
        { sku: { contains: term, mode: "insensitive" as const } },
        { category: { name: { contains: term, mode: "insensitive" as const } } },
      ],
    })),
  };

  const candidates = await prisma.inventoryItem.findMany({
    where,
    take: CANDIDATE_LIMIT,
    orderBy: { updatedAt: "desc" },
    include: {
      category: { select: { name: true, slug: true } },
      vendor: {
        select: {
          id: true,
          businessName: true,
          slug: true,
          addressLine1: true,
          city: true,
          state: true,
          rating: true,
          status: true,
          latitude: true,
          longitude: true,
          preferences: true,
        },
      },
    },
  });

  const hasOrigin = latitude !== undefined && longitude !== undefined;
  const lowerQ = q.trim().toLowerCase();

  let results = candidates.map((row) => {
    const { privacy } = readPreferences(row.vendor.preferences);
    const distanceKm =
      hasOrigin && row.vendor.latitude !== null && row.vendor.longitude !== null
        ? Math.round(
            haversineKm(latitude!, longitude!, row.vendor.latitude, row.vendor.longitude) * 10,
          ) / 10
        : null;

    // Simple relevance: exact-name match beats prefix beats contains, with a
    // nudge for vendor rating and fresh stock data.
    const name = row.name.toLowerCase();
    let relevance = name === lowerQ ? 100 : name.startsWith(lowerQ) ? 60 : 30;
    relevance += row.vendor.rating * 2;
    const hoursSinceUpdate = (Date.now() - row.updatedAt.getTime()) / 3_600_000;
    relevance += Math.max(0, 10 - hoursSinceUpdate / 24);

    return {
      inventoryItemId: row.id,
      name: row.name,
      imageUrl: row.imageUrl,
      // Vendors can hide exact stock or pricing; buyers then see "in stock" / "request a quote".
      quantity: privacy.showQuantities ? row.quantity : null,
      unit: row.unit,
      price: privacy.showPricing ? decimalToNumber(row.price) : null,
      currency: row.currency,
      status: row.status,
      updatedAt: row.updatedAt.toISOString(),
      category: row.category,
      vendor: {
        id: row.vendor.id,
        businessName: row.vendor.businessName,
        slug: row.vendor.slug,
        city: row.vendor.city,
        state: row.vendor.state,
        // Shown when a result card is expanded.
        addressLine1: row.vendor.addressLine1,
        rating: row.vendor.rating,
        verified: row.vendor.status === "VERIFIED",
        distanceKm,
      },
      relevance,
    };
  });

  if (hasOrigin && radiusKm !== undefined) {
    results = results.filter(
      (r) => r.vendor.distanceKm !== null && r.vendor.distanceKm <= radiusKm,
    );
  }

  // Vendors without coordinates sort last; equal distances (same vendor, or
  // vendors sharing a building) fall back to relevance.
  const byDistance = (a: typeof results[number], b: typeof results[number]) =>
    (a.vendor.distanceKm ?? Infinity) - (b.vendor.distanceKm ?? Infinity) ||
    b.relevance - a.relevance;

  results.sort((a, b) => {
    switch (sort) {
      case "distance":
        return byDistance(a, b);
      case "price":
        return (a.price ?? Infinity) - (b.price ?? Infinity);
      case "quantity":
        return (b.quantity ?? 0) - (a.quantity ?? 0);
      default:
        return b.relevance - a.relevance;
    }
  });

  const total = results.length;
  const pageRows = results
    .slice((page - 1) * limit, page * limit)
    .map(({ relevance: _relevance, ...rest }) => rest);

  // Every vendor that matched counts as seen, not just those on this page.
  recordImpressions(results.map((r) => r.vendor.id));

  // Logging must never break a search.
  prisma.searchQuery
    .create({
      data: {
        term: q.trim().slice(0, 200),
        categoryId: category?.id ?? null,
        city: city ?? null,
        state: state ?? null,
        resultCount: total,
        userId,
      },
    })
    .catch((err: unknown) => logger.warn(`search log failed: ${String(err)}`));

  return { rows: pageRows, meta: { page, limit, total } };
}

