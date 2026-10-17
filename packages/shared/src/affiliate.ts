import { z } from "zod";
import { paginationQuerySchema } from "./common.js";

export const affiliateApplicationSchema = z.object({
  payoutEmail: z.string().email().max(254),
  audienceDescription: z.string().min(10).max(2000),
  website: z.string().url().max(255).optional().nullable().or(z.literal("")),
  promotionChannels: z.array(z.string().max(60)).min(1).max(10),
});
export type AffiliateApplicationInput = z.infer<
  typeof affiliateApplicationSchema
>;

export const payoutRequestSchema = z.object({
  amount: z.coerce.number().min(1),
  method: z.enum(["BANK_TRANSFER", "PAYSTACK"]).default("BANK_TRANSFER"),
});
export type PayoutRequestInput = z.infer<typeof payoutRequestSchema>;

export const referralQuerySchema = paginationQuerySchema.extend({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type ReferralQuery = z.infer<typeof referralQuerySchema>;
