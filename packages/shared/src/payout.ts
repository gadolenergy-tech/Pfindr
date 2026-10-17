import { z } from "zod";

export const recordPayoutSchema = z.object({
  currency: z.string().length(3).transform((c) => c.toUpperCase()),
  amount: z.number().positive().max(1_000_000_000),
  /** Bank transfer reference, for reconciling against the statement. */
  reference: z.string().trim().max(100).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});
export type RecordPayoutInput = z.infer<typeof recordPayoutSchema>;

/** What Finder holds for a vendor in one currency. All amounts in major units. */
export type VendorBalance = {
  currency: string;
  /** Paid, un-refunded checkout orders. */
  gross: number;
  /** Finder's cut of `gross`. */
  fee: number;
  /** gross - fee: what the vendor has earned. */
  earned: number;
  paidOut: number;
  /** earned - paidOut: what Finder still owes. Negative after a refund that follows a payout. */
  owed: number;
};

export type VendorPayoutRecord = {
  id: string;
  amount: number;
  currency: string;
  reference: string | null;
  note: string | null;
  paidAt: string;
};

export type AdminVendorBalance = VendorBalance & {
  vendorId: string;
  businessName: string;
  contactEmail: string;
};
