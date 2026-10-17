import { z } from "zod";

/**
 * Enum values are the single source of truth for both the Prisma schema
 * (apps/api/prisma/schema.prisma) and the two Next.js apps. When you add a
 * member here, mirror it in the Prisma enum of the same name.
 */

export const ROLES = ["USER", "VENDOR", "ADMIN"] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const VENDOR_STATUSES = [
  "PENDING",
  "VERIFIED",
  "SUSPENDED",
  "REJECTED",
] as const;
export const vendorStatusSchema = z.enum(VENDOR_STATUSES);
export type VendorStatus = z.infer<typeof vendorStatusSchema>;

export const INVENTORY_STATUSES = [
  "IN_STOCK",
  "LOW_STOCK",
  "OUT_OF_STOCK",
  "DISCONTINUED",
] as const;
export const inventoryStatusSchema = z.enum(INVENTORY_STATUSES);
export type InventoryStatus = z.infer<typeof inventoryStatusSchema>;

export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "FULFILLED",
  "CANCELLED",
  "REFUNDED",
] as const;
export const orderStatusSchema = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const ORDER_SOURCES = ["VENDOR", "CHECKOUT"] as const;
export const orderSourceSchema = z.enum(ORDER_SOURCES);
export type OrderSource = z.infer<typeof orderSourceSchema>;

export const FULFILMENTS = ["PICKUP", "DELIVERY"] as const;
export const fulfilmentSchema = z.enum(FULFILMENTS);
export type Fulfilment = z.infer<typeof fulfilmentSchema>;

export const CHECKOUT_STATUSES = ["PENDING", "PAID", "EXPIRED", "FAILED"] as const;
export const checkoutStatusSchema = z.enum(CHECKOUT_STATUSES);
export type CheckoutStatus = z.infer<typeof checkoutStatusSchema>;

export const AFFILIATE_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED"] as const;
export const affiliateStatusSchema = z.enum(AFFILIATE_STATUSES);
export type AffiliateStatus = z.infer<typeof affiliateStatusSchema>;

export const PAYOUT_STATUSES = ["PENDING", "PAID", "FAILED"] as const;
export const payoutStatusSchema = z.enum(PAYOUT_STATUSES);
export type PayoutStatus = z.infer<typeof payoutStatusSchema>;

export const PARTNER_STATUSES = [
  "INQUIRY",
  "IN_REVIEW",
  "ACTIVE",
  "DECLINED",
] as const;
export const partnerStatusSchema = z.enum(PARTNER_STATUSES);
export type PartnerStatus = z.infer<typeof partnerStatusSchema>;

export const API_KEY_SCOPES = [
  "SEARCH_READ",
  "INVENTORY_READ",
  "INVENTORY_WRITE",
  "ORDERS_READ",
  "ORDERS_WRITE",
] as const;
export const apiKeyScopeSchema = z.enum(API_KEY_SCOPES);
export type ApiKeyScope = z.infer<typeof apiKeyScopeSchema>;

/** Top-level discovery categories shown on the landing page. */
export const CATEGORY_SLUGS = [
  "healthcare",
  "food-beverage",
  "industrial",
  "oil-gas",
  "emergency",
  "everyday",
] as const;
export const categorySlugSchema = z.enum(CATEGORY_SLUGS);
export type CategorySlug = z.infer<typeof categorySlugSchema>;
