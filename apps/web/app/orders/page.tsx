"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Package, Store, Truck } from "lucide-react";
import type { Purchase } from "@finder/shared";
import { Navbar } from "@/components/navbar";
import { AuthGuard } from "@/components/auth-guard";
import { api } from "@/lib/api";
import { formatMoney, timeAgo } from "@/lib/vendor-api";
import { purchaseState, TONE_CLASSES } from "@/lib/purchases";

/** Everything the signed-in buyer has bought (or started buying) with Buy now. */
export default function MyOrdersPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["purchases"],
    queryFn: () => api.get<Purchase[]>("/purchases"),
  });

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#040a15]">
        <Navbar />
        <main className="pt-28 pb-16 px-4 max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-white">My orders</h1>
          <p className="text-sm text-slate-500 mt-1">Products you&apos;ve bought on Finder.</p>

          <div className="mt-6 space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-600" /></div>
            ) : isError ? (
              <p className="text-sm text-red-300">We couldn&apos;t load your orders. Please refresh.</p>
            ) : !data || data.length === 0 ? (
              <div className="text-center py-16 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <Package className="h-8 w-8 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-400 mt-3">No orders yet.</p>
                <Link href="/" className="text-sm text-blue-400 hover:underline">Search for a product</Link>
              </div>
            ) : (
              data.map((p) => {
                const state = purchaseState(p);
                return (
                  <div key={p.reference} data-testid={`purchase-${p.reference}`}
                    className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold text-white">{p.quantity} × {p.name}</div>
                        <div className="text-[12px] text-slate-500 mt-0.5">
                          {p.vendor.businessName}{p.vendor.city && ` · ${p.vendor.city}`}
                        </div>
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider font-semibold border rounded-full px-2 py-0.5 ${TONE_CLASSES[state.tone]}`}>
                        {state.label}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-400">
                      <span className="font-semibold text-white tabular-nums">{formatMoney(p.total, p.currency)}</span>
                      <span className="flex items-center gap-1">
                        {p.fulfilment === "DELIVERY" ? <Truck className="h-3 w-3" /> : <Store className="h-3 w-3" />}
                        {p.fulfilment === "DELIVERY" ? "Delivery" : "Pickup"}
                      </span>
                      {p.order && <span className="font-mono text-slate-500">{p.order.orderNumber}</span>}
                      <span className="text-slate-600">{timeAgo(p.createdAt)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
