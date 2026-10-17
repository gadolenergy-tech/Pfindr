import { Router } from "express";
import { z } from "zod";
import { updateVendorPreferencesSchema, updateVendorSchema, type UpdateVendorPreferencesInput } from "@finder/shared";
import type { Prisma } from "@prisma/client";
import { mergePreferences, readPreferences } from "../services/preferences.service";
import { prisma } from "../lib/prisma";
import { ok } from "../lib/respond";
import { validateBody } from "../middleware/validate";
import { requireAuth, requireVendor, vendorIdOf } from "../middleware/auth";
import { assertOwnImageUrl } from "../lib/storage";
import { notFound } from "../lib/errors";
import { recordProfileView } from "../services/stats.service";

const router = Router();

/** The signed-in vendor's own profile — backs /vendor/settings. */
router.get("/vendors/me", requireAuth, requireVendor, async (req, res) => {
  const vendor = await prisma.vendor.findUnique({
    where: { userId: req.auth!.sub },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
  if (!vendor) throw notFound("You do not have a vendor profile yet");
  return ok(res, { ...vendor, preferences: readPreferences(vendor.preferences) });
});

router.patch(
  "/vendors/me",
  requireAuth,
  requireVendor,
  validateBody(updateVendorSchema),
  async (req, res) => {
    const input = req.body as import("@finder/shared").UpdateVendorInput;
    assertOwnImageUrl(vendorIdOf(req), input.logoUrl);

    const categoryId = input.categorySlug
      ? (
          await prisma.category.findUnique({
            where: { slug: input.categorySlug },
            select: { id: true },
          })
        )?.id ?? null
      : undefined;

    const vendor = await prisma.vendor.update({
      where: { userId: req.auth!.sub },
      data: {
        businessName: input.businessName,
        description: input.description,
        contactEmail: input.contactEmail?.toLowerCase(),
        contactPhone: input.contactPhone,
        website: input.website === undefined ? undefined : input.website || null,
        logoUrl: input.logoUrl,
        registrationNumber: input.registrationNumber,
        ...(categoryId !== undefined ? { categoryId } : {}),
        ...(input.address
          ? {
              addressLine1: input.address.line1,
              addressLine2: input.address.line2 ?? null,
              city: input.address.city,
              state: input.address.state,
              country: input.address.country,
              postalCode: input.address.postalCode ?? null,
              // Omitted coordinates keep the pinned location; only an explicit
              // null clears it. Otherwise any address edit drops the vendor to
              // the bottom of every proximity search.
              latitude: input.address.latitude,
              longitude: input.address.longitude,
            }
          : {}),
      },
    });

    return ok(res, vendor);
  },
);

/** Merges a partial preferences update; unspecified keys keep their values. */
router.patch(
  "/vendors/me/preferences",
  requireAuth,
  requireVendor,
  validateBody(updateVendorPreferencesSchema),
  async (req, res) => {
    const current = await prisma.vendor.findUnique({
      where: { userId: req.auth!.sub },
      select: { preferences: true },
    });
    if (!current) throw notFound("You do not have a vendor profile yet");

    const preferences = mergePreferences(current.preferences, req.body as UpdateVendorPreferencesInput);
    await prisma.vendor.update({
      where: { userId: req.auth!.sub },
      data: { preferences: preferences as unknown as Prisma.InputJsonValue },
    });
    return ok(res, preferences);
  },
);

/** Pause or resume every listing at once — the inventory page's kill switch. */
router.patch(
  "/vendors/me/listing",
  requireAuth,
  requireVendor,
  validateBody(z.object({ paused: z.boolean() })),
  async (req, res) => {
    const vendor = await prisma.vendor.update({
      where: { userId: req.auth!.sub },
      data: { listingPaused: req.body.paused },
      select: { id: true, listingPaused: true },
    });
    return ok(res, vendor);
  },
);

/** Public vendor page. Only verified vendors are discoverable. */
router.get("/vendors/:slug", async (req, res) => {
  const vendor = await prisma.vendor.findFirst({
    where: { slug: req.params.slug, status: "VERIFIED" },
    select: {
      id: true,
      businessName: true,
      slug: true,
      description: true,
      logoUrl: true,
      website: true,
      rating: true,
      reviewCount: true,
      city: true,
      state: true,
      country: true,
      createdAt: true,
      category: { select: { name: true, slug: true } },
      _count: { select: { inventoryItems: true } },
    },
  });
  if (!vendor) throw notFound("No such vendor");
  recordProfileView(vendor.id);
  return ok(res, vendor);
});

export default router;
