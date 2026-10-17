import { z } from "zod";
import { checkoutStatusSchema, fulfilmentSchema, orderStatusSchema } from "./enums.js";

/** "Buy now" on a search result. Price and vendor come from the server, never the client. */
export const createCheckoutSchema = z
  .object({
    inventoryItemId: z.string().min(1),
    quantity: z.coerce.number().int().min(1, "Buy at least one").max(1000),
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

/** A checkout as the buyer sees it — before and after payment. */
export const purchaseSchema = z.object({
  reference: z.string(),
  status: checkoutStatusSchema,
  name: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
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
