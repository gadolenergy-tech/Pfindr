"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { Minus, Package, Plus, ShoppingCart, Trash2, Zap } from "lucide-react";
import type { DiscoverResult } from "@finder/shared";
import { Navbar } from "@/components/navbar";
import { AuthGuard } from "@/components/auth-guard";
import { CheckoutDialog, type CheckoutItem } from "@/components/checkout-dialog";
import { api, ApiError } from "@/lib/api";
import { useCart, type CartItem } from "@/lib/cart";
import { formatMoney } from "@/lib/vendor-api";

type Group = { vendorId: string; vendor: string; vendorCity: string; items: CartItem[] };

/** The cart, one block per vendor: each vendor is paid in its own payment. */
function CartContents() {
  const cart = useCart();
  const [paying, setPaying] = useState<string | null>(null);

  // Refresh price and stock from the server, so the buyer sees what they would
  // actually be charged. A 404 means the product was removed or sold out of the network.
  const fresh = useQueries({
    queries: cart.items.map((i) => ({
      queryKey: ["product", i.inventoryItemId],
      retry: false,
      queryFn: () => api.get<DiscoverResult>(`/discover/items/${encodeURIComponent(i.inventoryItemId)}`),
    })),
  });
  const live = new Map<string, DiscoverResult | "gone">();
  cart.items.forEach((i, idx) => {
    const q = fresh[idx];
    if (q?.data) live.set(i.inventoryItemId, q.data);
    else if (q?.error instanceof ApiError && q.error.status === 404) live.set(i.inventoryItemId, "gone");
  });

  /** The cart line with the latest price, stock, brand and photo laid over it. */
  const view = (i: CartItem): CartItem & { gone: boolean; quote: boolean } => {
    const f = live.get(i.inventoryItemId);
    if (f === "gone") return { ...i, gone: true, quote: false };
    if (!f) return { ...i, gone: false, quote: false };
    const quote = f.price === null || f.price <= 0;
    return {
      ...i,
      name: f.name,
      brand: f.brand,
      imageUrl: f.imageUrl,
      unitPrice: f.price ?? i.unitPrice,
      currency: f.currency,
      stock: f.quantity,
      gone: false,
      quote,
    };
  };

  const groups: Group[] = [];
  for (const raw of cart.items) {
    let g = groups.find((x) => x.vendorId === raw.vendorId);
    if (!g) groups.push((g = { vendorId: raw.vendorId, vendor: raw.vendor, vendorCity: raw.vendorCity, items: [] }));
    g.items.push(raw);
  }

  if (cart.items.length === 0) {
    return (
      <div className="text-center py-20 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <ShoppingCart className="h-9 w-9 text-slate-600 mx-auto" />
        <p className="text-sm text-slate-400 mt-3">Your cart is empty.</p>
        <Link href="/?search=resume" className="text-sm text-blue-400 hover:underline">Search for a product</Link>
      </div>
    );
  }

  const payingGroup = groups.find((g) => g.vendorId === paying);
  const payable = payingGroup?.items.map(view).filter((i) => !i.gone && !i.quote) ?? [];

  return (
    <div className="space-y-5">
      {groups.length > 1 && (
        <p className="text-[12px] text-slate-500">
          Your cart has products from {groups.length} vendors. Each vendor is paid separately, so you&apos;ll pay once per vendor.
        </p>
      )}

      {groups.map((g) => {
        const rows = g.items.map(view);
        const payableRows = rows.filter((r) => !r.gone && !r.quote);
        const currencies = new Set(payableRows.map((r) => r.currency));
        const subtotal = payableRows.reduce((sum, r) => sum + r.unitPrice * r.quantity, 0);
        return (
          <section key={g.vendorId} data-testid={`cart-vendor-${g.vendorId}`} className="rounded-2xl border border-white/[0.07] bg-white/[0.02]">
            <header className="px-5 py-3.5 border-b border-white/[0.06]">
              <div className="text-[14px] font-semibold text-white">{g.vendor}</div>
              {g.vendorCity && <div className="text-[11px] text-slate-500">{g.vendorCity}</div>}
            </header>

            <ul className="divide-y divide-white/[0.05]">
              {rows.map((r) => (
                <li key={r.inventoryItemId} data-testid={`cart-line-${r.inventoryItemId}`} className="flex items-center gap-3.5 px-5 py-3.5">
                  <Link href={`/product/${r.inventoryItemId}`} className="w-14 h-14 rounded-xl bg-white/[0.04] border border-white/[0.06] overflow-hidden flex items-center justify-center shrink-0">
                    {r.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- bucket host is configured per environment
                      <img src={r.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="h-5 w-5 text-slate-600" />
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/product/${r.inventoryItemId}`} className="text-[13px] font-semibold text-slate-100 hover:underline line-clamp-2">{r.name}</Link>
                    {r.brand && <div className="text-[11px] text-slate-400">{r.brand}</div>}
                    {r.gone ? (
                      <div className="text-[11px] text-red-400 mt-0.5">No longer available. Remove it to continue.</div>
                    ) : r.quote ? (
                      <div className="text-[11px] text-amber-400 mt-0.5">Quoted on request. Message the vendor to buy.</div>
                    ) : (
                      <div className="text-[11px] text-slate-500 mt-0.5">{formatMoney(r.unitPrice, r.currency)} per {r.unit}</div>
                    )}
                  </div>

                  {!r.gone && !r.quote && (
                    <div className="flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] shrink-0">
                      <button type="button" aria-label="Fewer" disabled={r.quantity <= 1} onClick={() => cart.setQuantity(r.inventoryItemId, r.quantity - 1)} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-9 text-center text-sm text-white tabular-nums">{r.quantity}</span>
                      <button type="button" aria-label="More" disabled={r.stock !== null && r.quantity >= r.stock} onClick={() => cart.setQuantity(r.inventoryItemId, r.quantity + 1)} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="w-24 text-right text-[13px] font-semibold text-white tabular-nums shrink-0">
                    {!r.gone && !r.quote ? formatMoney(r.unitPrice * r.quantity, r.currency) : "—"}
                  </div>
                  <button type="button" aria-label={`Remove ${r.name}`} onClick={() => cart.remove(r.inventoryItemId)} className="p-1.5 text-slate-600 hover:text-red-400 shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>

            <footer className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-white/[0.06]">
              <div>
                <div className="text-[11px] text-slate-500">Subtotal</div>
                <div data-testid={`cart-subtotal-${g.vendorId}`} className="text-lg font-bold text-white tabular-nums">
                  {currencies.size === 1 ? formatMoney(subtotal, [...currencies][0]) : "—"}
                </div>
              </div>
              {currencies.size > 1 ? (
                <p className="text-[11px] text-amber-400 max-w-xs">These products are priced in different currencies. Remove some to pay.</p>
              ) : (
                <button type="button" data-testid={`cart-pay-${g.vendorId}`} disabled={payableRows.length === 0 || rows.some((r) => r.gone)}
                  onClick={() => setPaying(g.vendorId)}
                  className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center gap-2 transition-colors">
                  <Zap className="h-4 w-4" /> Pay now
                </button>
              )}
            </footer>
          </section>
        );
      })}

      <Link href="/?search=resume" className="inline-block text-sm text-blue-400 hover:underline">← Keep shopping</Link>

      <AnimatePresence>
        {payingGroup && payable.length > 0 && (
          <CheckoutDialog
            key="checkout"
            items={payable.map<CheckoutItem>((i) => ({
              inventoryItemId: i.inventoryItemId,
              name: i.name,
              brand: i.brand,
              imageUrl: i.imageUrl,
              vendor: i.vendor,
              vendorCity: i.vendorCity,
              unitPrice: i.unitPrice,
              currency: i.currency,
              unit: i.unit,
              stock: i.stock,
            }))}
            quantities={Object.fromEntries(payable.map((i) => [i.inventoryItemId, i.quantity]))}
            onClose={() => setPaying(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CartPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#040a15]">
        <Navbar />
        <main className="pt-28 pb-16 px-4 max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-white">Your cart</h1>
          <p className="text-sm text-slate-500 mt-1 mb-6">Review what you picked, then pay.</p>
          <CartContents />
        </main>
      </div>
    </AuthGuard>
  );
}
