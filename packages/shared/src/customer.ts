import { z } from "zod";
import { paginationQuerySchema } from "./common.js";
import { emailSchema } from "./auth.js";

export const createCustomerSchema = z.object({
  fullName: z.string().min(2).max(160),
  email: emailSchema.optional().nullable(),
  phone: z.string().min(7).max(20).optional().nullable(),
  company: z.string().max(160).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.partial();
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const customerQuerySchema = paginationQuerySchema.extend({
  q: z.string().max(200).optional(),
});
export type CustomerQuery = z.infer<typeof customerQuerySchema>;
