import { z } from "zod";
import { addressSchema } from "./common.js";
import { vendorStatusSchema } from "./enums.js";
import { emailSchema, passwordSchema } from "./auth.js";

export const vendorProfileSchema = z.object({
  businessName: z.string().min(2, "Business name is required").max(160),
  description: z.string().max(2000).optional().nullable(),
  categorySlug: z.string().min(1, "Pick a category"),
  contactEmail: emailSchema,
  contactPhone: z.string().min(7).max(20),
  website: z.string().url().max(255).optional().nullable().or(z.literal("")),
  logoUrl: z.string().url().max(500).optional().nullable(),
  registrationNumber: z.string().max(60).optional().nullable(),
  address: addressSchema,
});
export type VendorProfileInput = z.infer<typeof vendorProfileSchema>;

/** POST /auth/register/vendor — creates the User and Vendor in one transaction. */
export const vendorSignupSchema = vendorProfileSchema.extend({
  fullName: z.string().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms" }),
  }),
});
export type VendorSignupInput = z.infer<typeof vendorSignupSchema>;

export const updateVendorSchema = vendorProfileSchema.partial();
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;

/** Admin-only transition. */
export const vendorStatusUpdateSchema = z.object({
  status: vendorStatusSchema,
  reason: z.string().max(500).optional().nullable(),
});
export type VendorStatusUpdateInput = z.infer<typeof vendorStatusUpdateSchema>;

export const vendorSchema = z.object({
  id: z.string(),
  userId: z.string(),
  businessName: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  categoryId: z.string().nullable(),
  contactEmail: z.string(),
  contactPhone: z.string(),
  website: z.string().nullable(),
  logoUrl: z.string().nullable(),
  registrationNumber: z.string().nullable(),
  status: vendorStatusSchema,
  verifiedAt: z.string().nullable(),
  rating: z.number(),
  reviewCount: z.number(),
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  postalCode: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Vendor = z.infer<typeof vendorSchema>;

/**
 * Settings-page preferences. The privacy flags are enforced by discover; the
 * default threshold applies to newly listed items; notification flags are
 * stored for when email delivery is wired.
 */
export const vendorPreferencesSchema = z.object({
  notifications: z
    .object({
      newOrders: z.boolean().default(true),
      lowStock: z.boolean().default(true),
      messages: z.boolean().default(true),
      syncErrors: z.boolean().default(true),
      weeklySummary: z.boolean().default(false),
      platformUpdates: z.boolean().default(false),
      marketing: z.boolean().default(false),
    })
    .default({}),
  privacy: z
    .object({
      showQuantities: z.boolean().default(true),
      showPricing: z.boolean().default(true),
      allowReviews: z.boolean().default(true),
      shareAnalytics: z.boolean().default(false),
    })
    .default({}),
  defaults: z
    .object({
      currency: z.enum(["NGN", "USD", "EUR", "GBP"]).default("NGN"),
      lowStockThreshold: z.coerce.number().int().min(0).max(100_000).default(10),
    })
    .default({}),
});
export type VendorPreferences = z.infer<typeof vendorPreferencesSchema>;

export const updateVendorPreferencesSchema = z.object({
  notifications: vendorPreferencesSchema.shape.notifications.removeDefault().partial().optional(),
  privacy: vendorPreferencesSchema.shape.privacy.removeDefault().partial().optional(),
  defaults: vendorPreferencesSchema.shape.defaults.removeDefault().partial().optional(),
});
export type UpdateVendorPreferencesInput = z.infer<typeof updateVendorPreferencesSchema>;
