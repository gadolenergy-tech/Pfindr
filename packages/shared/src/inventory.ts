import { z } from "zod";
import { inventoryStatusSchema } from "./enums.js";
import { paginationQuerySchema } from "./common.js";

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  parentId: z.string().nullable(),
  sortOrder: z.number(),
});
export type Category = z.infer<typeof categorySchema>;

export const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  brand: z.string().nullable(),
  categoryId: z.string().nullable(),
  imageUrl: z.string().nullable(),
  defaultUnit: z.string(),
});
export type Product = z.infer<typeof productSchema>;

export const createProductSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional().nullable(),
  brand: z.string().max(120).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  imageUrl: z.string().url().max(500).optional().nullable(),
  defaultUnit: z.string().min(1).max(30).default("unit"),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

/** One vendor's stock line for one product — the core Finder record. */
export const createInventoryItemSchema = z.object({
  productId: z.string().optional().nullable(),
  /** Free-text name when the vendor is listing something not yet in the catalog. */
  name: z.string().min(2).max(200),
  sku: z.string().max(80).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  quantity: z.coerce.number().int().min(0),
  unit: z.string().min(1).max(30).default("unit"),
  price: z.coerce.number().min(0),
  currency: z.string().length(3).default("NGN"),
  lowStockThreshold: z.coerce.number().int().min(0).default(10),
  status: inventoryStatusSchema.optional(),
  imageUrl: z.string().url().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});
export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;

export const updateInventoryItemSchema = createInventoryItemSchema.partial();
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;

/** Bulk quantity adjustment used by the AI Inventory Sync Center. */
export const inventorySyncSchema = z.object({
  items: z
    .array(
      z.object({
        sku: z.string().min(1).max(80),
        quantity: z.coerce.number().int().min(0),
        price: z.coerce.number().min(0).optional(),
        /** Required only when the SKU is new to this vendor. */
        name: z.string().min(2).max(200).optional(),
      }),
    )
    .min(1)
    .max(1000),
});
export type InventorySyncInput = z.infer<typeof inventorySyncSchema>;

export const inventoryQuerySchema = paginationQuerySchema.extend({
  q: z.string().max(200).optional(),
  categoryId: z.string().optional(),
  status: inventoryStatusSchema.optional(),
  sort: z.enum(["name", "quantity", "price", "updatedAt"]).default("updatedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});
export type InventoryQuery = z.infer<typeof inventoryQuerySchema>;
