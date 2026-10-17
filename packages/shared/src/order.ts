import { z } from "zod";
import { orderStatusSchema } from "./enums.js";
import { paginationQuerySchema } from "./common.js";
import { createCustomerSchema } from "./customer.js";

/**
 * A vendor records an order against their own stock — usually after agreeing a
 * quote in messages. Either an existing customerId or an inline new customer.
 * vendorId is never accepted from the client; it comes from the session.
 */
export const createOrderSchema = z
  .object({
    customerId: z.string().optional().nullable(),
    customer: createCustomerSchema.optional().nullable(),
    items: z
      .array(
        z.object({
          inventoryItemId: z.string().min(1),
          quantity: z.coerce.number().int().min(1),
          /** Agreed price per unit; defaults to the listed price. */
          unitPrice: z.coerce.number().min(0).optional(),
        }),
      )
      .min(1, "An order needs at least one item")
      .max(50),
    note: z.string().max(1000).optional().nullable(),
  })
  .refine((v) => v.customerId || v.customer, {
    message: "Pick a customer or add a new one",
    path: ["customerId"],
  });
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({
  status: orderStatusSchema,
  note: z.string().max(1000).optional().nullable(),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

export const orderQuerySchema = paginationQuerySchema.extend({
  q: z.string().max(200).optional(),
  status: orderStatusSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type OrderQuery = z.infer<typeof orderQuerySchema>;
