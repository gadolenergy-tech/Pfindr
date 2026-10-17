import { z } from "zod";

export const partnerInquirySchema = z.object({
  companyName: z.string().min(2).max(160),
  contactName: z.string().min(2).max(120),
  contactEmail: z.string().email().max(254),
  contactPhone: z.string().min(7).max(20).optional().nullable(),
  website: z.string().url().max(255).optional().nullable().or(z.literal("")),
  partnershipType: z.enum([
    "TECHNOLOGY",
    "DISTRIBUTION",
    "LOGISTICS",
    "DATA",
    "RESELLER",
    "OTHER",
  ]),
  message: z.string().min(10).max(5000),
});
export type PartnerInquiryInput = z.infer<typeof partnerInquirySchema>;
