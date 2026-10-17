import type { Purchase } from "@finder/shared";

/** One label and colour per purchase state, as the buyer should read it. */
export function purchaseState(p: Purchase): { label: string; tone: "green" | "blue" | "amber" | "slate" | "red" } {
  if (p.status === "PENDING") return { label: "Awaiting payment", tone: "amber" };
  if (p.status === "EXPIRED") return { label: "Expired · not paid", tone: "slate" };
  if (p.status === "FAILED") return { label: "Payment failed", tone: "red" };
  switch (p.order?.status) {
    case "CONFIRMED":
      return { label: "Confirmed by vendor", tone: "blue" };
    case "PROCESSING":
      return { label: "Being prepared", tone: "blue" };
    case "FULFILLED":
      return { label: "Completed", tone: "green" };
    case "CANCELLED":
      return { label: "Cancelled", tone: "red" };
    case "REFUNDED":
      return { label: "Refunded", tone: "slate" };
    default:
      return { label: "Paid · awaiting vendor", tone: "green" };
  }
}

export const TONE_CLASSES = {
  green: "text-green-300 bg-green-500/10 border-green-500/25",
  blue: "text-blue-300 bg-blue-500/10 border-blue-500/25",
  amber: "text-amber-300 bg-amber-500/10 border-amber-500/25",
  slate: "text-slate-400 bg-white/[0.04] border-white/[0.08]",
  red: "text-red-300 bg-red-500/10 border-red-500/25",
} as const;
