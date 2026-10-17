import { z } from "zod";
import { paginationQuerySchema } from "./common.js";

/**
 * The public discovery query behind the landing-page search modal: what is in
 * stock, how much, at what price, from the nearest vendor.
 */
export const discoverQuerySchema = paginationQuerySchema.extend({
  q: z.string().min(1, "Enter what you're looking for").max(200),
  categorySlug: z.string().optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  /**
   * Optional cutoff in kilometres, applied only with lat/lng. Omit it to rank
   * every match nationwide by distance — what the web search does.
   */
  radiusKm: z.coerce.number().min(1).max(500).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStockOnly: z.coerce.boolean().default(true),
  sort: z.enum(["relevance", "distance", "price", "quantity"]).default("relevance"),
});
export type DiscoverQuery = z.infer<typeof discoverQuerySchema>;

export const discoverResultSchema = z.object({
  inventoryItemId: z.string(),
  name: z.string(),
  imageUrl: z.string().nullable(),
  /** null when the vendor hides exact stock levels. */
  quantity: z.number().nullable(),
  unit: z.string(),
  /** null when the vendor hides pricing — buyers are asked to request a quote. */
  price: z.number().nullable(),
  currency: z.string(),
  status: z.string(),
  updatedAt: z.string(),
  category: z.object({ name: z.string(), slug: z.string() }).nullable(),
  vendor: z.object({
    id: z.string(),
    businessName: z.string(),
    slug: z.string(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    rating: z.number(),
    verified: z.boolean(),
    distanceKm: z.number().nullable(),
    addressLine1: z.string().nullable(),
  }),
});
export type DiscoverResult = z.infer<typeof discoverResultSchema>;
