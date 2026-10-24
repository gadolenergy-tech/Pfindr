import { z } from "zod";
import { checkoutStatusSchema, fulfilmentSchema, orderStatusSchema } from "./enums.js";

/** Most distinct products one payment can carry. */
export const CHECKOUT_MAX_LINES = 30;

/**
 * Pay now for a cart: one vendor's products, one payment. Price and vendor come
 * from the server, never the client; a single Buy now is a cart of one.
 */
export const createCheckoutSchema = z
  .object({
    items: z
      .array(
        z.object({
          inventoryItemId: z.string().min(1),
          quantity: z.coerce.number().int().min(1, "Buy at least one").max(1000),
        }),
      )
      .min(1, "Your cart is empty")
      .max(CHECKOUT_MAX_LINES),
    fulfilment: fulfilmentSchema,
    deliveryAddress: z.string().trim().max(500).optional().nullable(),
    buyerPhone: z
      .string()
      .trim()
      .min(7, "Enter a phone number the vendor can reach you on")
      .max(30),
  })
  .refine((v) => v.fulfilment !== "DELIVERY" || (v.deliveryAddress && v.deliveryAddress.length >= 5), {
    message: "Enter a delivery address",
    path: ["deliveryAddress"],
  });
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

export const checkoutStartedSchema = z.object({
  reference: z.string(),
  /** Paystack's hosted payment page — send the browser here. */
  authorizationUrl: z.string(),
  expiresAt: z.string(),
});
export type CheckoutStarted = z.infer<typeof checkoutStartedSchema>;

/** One product on a purchase, as the buyer saw it when they paid. */
export const purchaseLineSchema = z.object({
  /** null once the vendor has deleted the listing. */
  inventoryItemId: z.string().nullable(),
  name: z.string(),
  brand: z.string().nullable(),
  imageUrl: z.string().nullable(),
  quantity: z.number(),
  unitPrice: z.number(),
  lineTotal: z.number(),
});
export type PurchaseLine = z.infer<typeof purchaseLineSchema>;

/** A checkout as the buyer sees it — before and after payment. */
export const purchaseSchema = z.object({
  reference: z.string(),
  status: checkoutStatusSchema,
  items: z.array(purchaseLineSchema),
  total: z.number(),
  currency: z.string(),
  fulfilment: fulfilmentSchema,
  deliveryAddress: z.string().nullable(),
  createdAt: z.string(),
  vendor: z.object({ id: z.string(), businessName: z.string(), city: z.string().nullable() }),
  /** Present once paid. */
  order: z
    .object({
      orderNumber: z.string(),
      status: orderStatusSchema,
      paidAt: z.string().nullable(),
    })
    .nullable(),
});
export type Purchase = z.infer<typeof purchaseSchema>;
