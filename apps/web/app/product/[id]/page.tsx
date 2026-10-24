"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MapPin,
  MessageSquare,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  Zap,
} from "lucide-react";
import type { DiscoverResult } from "@finder/shared";
import { Navbar } from "@/components/navbar";
import { AuthGuard } from "@/components/auth-guard";
import { CheckoutDialog, type CheckoutItem } from "@/components/checkout-dialog";
import { api, ApiError } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/vendor-api";

const MAX_QTY = 1000;

/**
 * The page behind "View product images": the photo, brand and description the
 * buyer is agreeing to, with Add to cart / Pay now on the same page. Seeing
 * this before paying is what settles "which brand did I order?" later.
 */
function ProductDetail({ id }: { id: string }) {
  const { toast } = useToast();
  const cart = useCart();
  const [quantity, setQuantity] = useState(1);
  const [paying, setPaying] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["product", id],
    retry: false,
    queryFn: () => api.get<DiscoverResult>(`/discover/items/${encodeURIComponent(id)}`),
  });

  const message = useMutation({
    mutationFn: (p: DiscoverResult) =>
      api.post("/conversations", {
        vendorId: p.vendor.id,
        subject: `Enquiry: ${p.name}`,
        body: `Hello ${p.vendor.businessName}, I found ${p.name}${p.brand ? ` (${p.brand})` : ""} on Finder and would like a price and availability.`,
      }),
    onSuccess: (_d, p) =>
      toast({ title: "Message sent", description: `${p.vendor.businessName} will reply in your Finder inbox.` }),
    onError: (err: Error) =>
      toast({ title: "Could not reach vendor", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="flex justify-center py-32"><Loader2 className="h-6 w-6 animate-spin text-slate-600" /></div>;
  }
  if (error || !data) {
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <div className="max-w-md mx-auto text-center py-24">
        <Package className="h-10 w-10 text-slate-600 mx-auto" />
        <h1 className="text-lg font-semibold text-white mt-4">{gone ? "This product is no longer available" : "We couldn't load this product"}</h1>
        <p className="text-sm text-slate-500 mt-1">{gone ? "The vendor may have sold out or removed it." : "Please try again in a moment."}</p>
        <Link href="/?search=resume" className="inline-block mt-5 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-semibold text-white">Back to search</Link>
      </div>
    );
  }

  const p = data;
  const buyable = p.price !== null && p.price > 0;
  const soldOut = p.status === "OUT_OF_STOCK" || p.quantity === 0;
  const maxQty = Math.min(p.quantity ?? MAX_QTY, MAX_QTY);
  const inCart = cart.items.find((i) => i.inventoryItemId === p.inventoryItemId);
  const setQty = (n: number) => setQuantity(Math.max(1, Math.min(maxQty, Math.floor(n) || 1)));

  const item: CheckoutItem | null = buyable
    ? {
        inventoryItemId: p.inventoryItemId,
        name: p.name,
        brand: p.brand,
        imageUrl: p.imageUrl,
        vendor: p.vendor.businessName,
        vendorCity: p.vendor.city ?? "",
        unitPrice: p.price!,
        currency: p.currency,
        unit: p.unit,
        stock: p.quantity,
      }
    : null;

  function addToCart() {
    if (!item) return;
    cart.add(
      {
        inventoryItemId: item.inventoryItemId,
        name: item.name,
        brand: p.brand,
        imageUrl: p.imageUrl,
        vendorId: p.vendor.id,
        vendor: item.vendor,
        vendorCity: item.vendorCity,
        unitPrice: item.unitPrice,
        currency: item.currency,
        unit: item.unit,
        stock: item.stock,
      },
      quantity,
    );
    toast({ title: "Added to cart", description: `${quantity} × ${p.name}` });
  }

  return (
    <>
      <Link href="/?search=resume" data-testid="product-back" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to search
      </Link>

      <div className="mt-5 grid md:grid-cols-2 gap-8">
        {/* Photo */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] aspect-square overflow-hidden flex items-center justify-center">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- bucket host is configured per environment
            <img data-testid="product-image" src={p.imageUrl} alt={`${p.name}${p.brand ? ` by ${p.brand}` : ""}`} className="w-full h-full object-contain" />
          ) : (
            <div className="text-center px-6">
              <Package className="h-14 w-14 text-slate-700 mx-auto" />
              <p className="text-sm text-slate-500 mt-3">The vendor hasn&apos;t added a photo of this product yet.</p>
              <p className="text-xs text-slate-600 mt-1">Message them to ask what it looks like before you pay.</p>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-5">
          <div>
            {p.category && <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{p.category.name}</div>}
            <h1 className="text-2xl font-bold text-white mt-1 leading-tight">{p.name}</h1>
            {p.brand ? (
              <p data-testid="product-brand" className="text-sm text-slate-300 mt-1.5">
                <span className="text-slate-500">Brand / manufacturer: </span>
                <span className="font-semibold">{p.brand}</span>
              </p>
            ) : (
              <p className="text-sm text-slate-500 mt-1.5">Brand not stated by the vendor.</p>
            )}
          </div>

          {p.description && (
            <p data-testid="product-description" className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{p.description}</p>
          )}

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-sm text-white font-semibold">
              {p.vendor.businessName}
              {p.vendor.verified && (
                <span className="flex items-center gap-0.5 text-[11px] text-blue-400 font-medium"><CheckCircle2 className="h-3 w-3" /> Verified</span>
              )}
            </div>
            <div className="flex items-start gap-1.5 text-[12px] text-slate-400">
              <MapPin className="h-3.5 w-3.5 shrink-0 mt-px text-slate-500" />
              {[p.vendor.addressLine1, p.vendor.city, p.vendor.state].filter(Boolean).join(", ") || "Address not provided"}
            </div>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              {buyable ? (
                <>
                  <div className="text-3xl font-bold text-white tabular-nums">{formatMoney(p.price!, p.currency)}</div>
                  <div className="text-xs text-slate-500">per {p.unit}</div>
                </>
              ) : (
                <div className="text-lg font-semibold text-slate-300">Price on request</div>
              )}
            </div>
            <div className={`text-sm font-semibold ${soldOut ? "text-red-400" : p.status === "LOW_STOCK" ? "text-amber-400" : "text-green-400"}`}>
              {soldOut ? "Out of stock" : p.quantity !== null ? `${p.quantity.toLocaleString()} ${p.unit} in stock` : "In stock"}
            </div>
          </div>

          {buyable && !soldOut ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-[12px] font-medium text-slate-300">Quantity</span>
                <div className="flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                  <button type="button" onClick={() => setQty(quantity - 1)} disabled={quantity <= 1} className="p-2 text-slate-400 hover:text-white disabled:opacity-30" aria-label="Fewer">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input type="number" min={1} max={maxQty} value={quantity} onChange={(e) => setQty(Number(e.target.value))}
                    className="w-14 bg-transparent text-center text-sm text-white tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                  <button type="button" onClick={() => setQty(quantity + 1)} disabled={quantity >= maxQty} className="p-2 text-slate-400 hover:text-white disabled:opacity-30" aria-label="More">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button type="button" data-testid="product-add-to-cart" onClick={addToCart}
                  className="h-11 rounded-xl border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-200 text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                  <ShoppingCart className="h-4 w-4" /> Add to cart
                </button>
                <button type="button" data-testid="product-pay-now" onClick={() => setPaying(true)}
                  className="h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                  <Zap className="h-4 w-4" /> Pay now
                </button>
              </div>

              {inCart && (
                <div data-testid="product-in-cart" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-green-500/25 bg-green-500/10 px-4 py-2.5 text-[12px] text-green-300">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> {inCart.quantity} in your cart</span>
                  <span className="flex items-center gap-4">
                    <Link href="/?search=resume" className="font-semibold text-slate-200 hover:text-white">Keep shopping</Link>
                    <Link href="/cart" className="font-semibold text-white hover:underline">View cart &amp; pay</Link>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-[12px] text-slate-500">
                {soldOut ? "This vendor is out of stock right now." : "This vendor quotes on request, so there is nothing to pay online yet."}
              </p>
              <button type="button" disabled={message.isPending} onClick={() => message.mutate(p)}
                className="h-11 w-full rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-60 text-blue-200 text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                {message.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                Message vendor {buyable ? "" : "for a quote"}
              </button>
            </div>
          )}

          <p className="text-[11px] text-slate-600 leading-relaxed">
            Check the photo, brand and description above before you pay. They are recorded with your order, and the vendor is expected to supply this exact product.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {paying && item && <CheckoutDialog key="checkout" items={[{ ...item }]} onClose={() => setPaying(false)} />}
      </AnimatePresence>
    </>
  );
}

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#040a15]">
        <Navbar />
        <main className="pt-28 pb-16 px-4 max-w-5xl mx-auto">
          <ProductDetail id={params.id} />
        </main>
      </div>
    </AuthGuard>
  );
}
