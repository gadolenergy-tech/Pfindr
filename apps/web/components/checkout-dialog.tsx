"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Loader2, Lock, Minus, Package, Plus, Store, Truck, X, AlertCircle } from "lucide-react";
import type { CheckoutStarted, Fulfilment } from "@finder/shared";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/vendor-api";

export type CheckoutItem = {
  inventoryItemId: string;
  name: string;
  brand?: string | null;
  imageUrl?: string | null;
  vendor: string;
  vendorCity: string;
  unitPrice: number;
  currency: string;
  unit: string;
  /** Units on hand, or null when the vendor hides exact stock (the server still enforces it). */
  stock: number | null;
};

const MAX_QTY = 1000;

/**
 * Pay now: pickup or delivery and a phone number, then hand off to Paystack.
 * Price and stock are re-checked on the server.
 *
 * With `quantities` it pays for a cart's worth of one vendor's products at the
 * quantities chosen there. Without, it is a Buy now of `items[0]` and the buyer
 * picks the quantity here.
 */
export function CheckoutDialog({
  items,
  quantities,
  onClose,
}: {
  items: CheckoutItem[];
  quantities?: Record<string, number>;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const item = items[0]!;
  const maxQty = Math.min(item.stock ?? MAX_QTY, MAX_QTY);
  const [quantity, setQuantity] = useState(1);
  const qtyOf = (i: CheckoutItem) => (quantities ? quantities[i.inventoryItemId] ?? 1 : quantity);
  const [fulfilment, setFulfilment] = useState<Fulfilment>("PICKUP");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [buyerPhone, setBuyerPhone] = useState(user?.phone ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const total = Math.round(items.reduce((sum, i) => sum + i.unitPrice * qtyOf(i), 0) * 100) / 100;
  const setQty = (n: number) => setQuantity(Math.max(1, Math.min(maxQty, Math.floor(n) || 1)));

  async function pay(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const started = await api.post<CheckoutStarted>("/checkout", {
        items: items.map((i) => ({ inventoryItemId: i.inventoryItemId, quantity: qtyOf(i) })),
        fulfilment,
        deliveryAddress: fulfilment === "DELIVERY" ? deliveryAddress : null,
        buyerPhone,
      });
      // Leave for Paystack's hosted payment page; it returns to /checkout/complete.
      window.location.assign(started.authorizationUrl);
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setError("Could not start checkout. Please try again.");
      }
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[120] flex items-center justify-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => { e.stopPropagation(); if (!submitting) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.form
        data-testid="checkout-dialog"
        onSubmit={pay}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md rounded-2xl border border-white/[0.08] p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        style={{ background: "linear-gradient(160deg, #0b1830 0%, #060d1f 100%)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{quantities ? "Pay now" : "Buy now"}</div>
            <h2 className="text-[16px] font-semibold text-white mt-1 leading-snug">
              {quantities && items.length > 1 ? `${items.length} products` : item.name}
              {!quantities && item.brand && <span className="text-slate-400 font-normal"> · {item.brand}</span>}
            </h2>
            <p className="text-[12px] text-slate-500 mt-0.5">
              {item.vendor}{item.vendorCity && ` · ${item.vendorCity}`}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Close"
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* What you are paying for: the photo and brand shown on the product page */}
        <div className="space-y-2">
          {items.map((i) => (
            <div key={i.inventoryItemId} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
              <div className="w-11 h-11 rounded-lg bg-white/[0.04] border border-white/[0.06] overflow-hidden flex items-center justify-center shrink-0">
                {i.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- bucket host is configured per environment
                  <img src={i.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Package className="h-4 w-4 text-slate-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-slate-200 truncate">{i.name}</div>
                <div className="text-[11px] text-slate-500 truncate">
                  {i.brand && <>{i.brand} · </>}
                  {formatMoney(i.unitPrice, i.currency)} per {i.unit}
                </div>
              </div>
              {quantities && (
                <div className="text-right shrink-0">
                  <div className="text-[12px] font-semibold text-white tabular-nums">{qtyOf(i)} ×</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Quantity — Buy now only; a cart's quantities are set in the cart */}
        {!quantities && (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12px] font-medium text-slate-300">Quantity</div>
              <div className="text-[11px] text-slate-500">
                {formatMoney(item.unitPrice, item.currency)} per {item.unit}
                {item.stock !== null && ` · ${item.stock.toLocaleString()} in stock`}
              </div>
            </div>
            <div className="flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
              <button type="button" onClick={() => setQty(quantity - 1)} disabled={quantity <= 1}
                className="p-2 text-slate-400 hover:text-white disabled:opacity-30" aria-label="Fewer">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input type="number" min={1} max={maxQty} value={quantity} onChange={(e) => setQty(Number(e.target.value))}
                className="w-14 bg-transparent text-center text-sm text-white tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
              <button type="button" onClick={() => setQty(quantity + 1)} disabled={quantity >= maxQty}
                className="p-2 text-slate-400 hover:text-white disabled:opacity-30" aria-label="More">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
        {fieldErrors.quantity && <p className="text-[11px] text-red-400 -mt-3">{fieldErrors.quantity}</p>}

        {/* Fulfilment */}
        <div className="space-y-2">
          <div className="text-[12px] font-medium text-slate-300">How do you want it?</div>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: "PICKUP", icon: Store, label: "Pick up", sub: "From the vendor" },
              { value: "DELIVERY", icon: Truck, label: "Delivery", sub: "Fee agreed with vendor" },
            ] as const).map((opt) => (
              <button key={opt.value} type="button" onClick={() => setFulfilment(opt.value)}
                className={`flex items-start gap-2 rounded-xl border p-3 text-left transition-all ${
                  fulfilment === opt.value
                    ? "border-blue-500/40 bg-blue-500/10"
                    : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]"
                }`}>
                <opt.icon className={`h-4 w-4 mt-px ${fulfilment === opt.value ? "text-blue-400" : "text-slate-500"}`} />
                <div>
                  <div className="text-[12px] font-semibold text-slate-200">{opt.label}</div>
                  <div className="text-[10px] text-slate-500">{opt.sub}</div>
                </div>
              </button>
            ))}
          </div>
          {fulfilment === "DELIVERY" && (
            <div>
              <textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} rows={2} maxLength={500}
                placeholder="Delivery address, with a landmark"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-blue-500/40 resize-none" />
              {fieldErrors.deliveryAddress && <p className="text-[11px] text-red-400">{fieldErrors.deliveryAddress}</p>}
            </div>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <label htmlFor="buyerPhone" className="text-[12px] font-medium text-slate-300">Your phone number</label>
          <input id="buyerPhone" type="tel" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)}
            placeholder="+234 800 000 0000" autoComplete="tel"
            className="w-full h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-blue-500/40" />
          {fieldErrors.buyerPhone
            ? <p className="text-[11px] text-red-400">{fieldErrors.buyerPhone}</p>
            : <p className="text-[10px] text-slate-500">The vendor uses this to arrange the handover.</p>}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-[12px] text-red-300">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" /> {error}
          </div>
        )}

        {/* Total + pay */}
        <div className="pt-4 border-t border-white/[0.06] space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] text-slate-400">Total</span>
            <span data-testid="checkout-total" className="text-xl font-bold text-white tabular-nums">{formatMoney(total, item.currency)}</span>
          </div>
          <button type="submit" disabled={submitting}
            className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {submitting ? "Opening secure payment…" : `Pay ${formatMoney(total, item.currency)}`}
          </button>
          <p className="text-[10px] text-slate-500 text-center">
            Secure payment by Paystack. Stock is held for you for 30 minutes.
          </p>
        </div>
      </motion.form>
    </motion.div>
  );
}
