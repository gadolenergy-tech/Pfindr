"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, XCircle, Store, Truck } from "lucide-react";
import type { Purchase } from "@finder/shared";
import { Navbar } from "@/components/navbar";
import { AuthGuard } from "@/components/auth-guard";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/vendor-api";

/** Stop polling after this long; the webhook or My orders picks it up later. */
const POLL_FOR_MS = 60_000;

/** Paystack sends the buyer here with ?reference=… after the payment page. */
function CheckoutResult() {
  const params = useSearchParams();
  const reference = params.get("reference") ?? params.get("trxref");
  const [startedAt] = useState(() => Date.now());
  const [gaveUp, setGaveUp] = useState(false);

  const { data, isError, error } = useQuery({
    queryKey: ["checkout", reference],
    enabled: !!reference,
    queryFn: () => api.get<Purchase>(`/checkout/${encodeURIComponent(reference!)}`),
    // Paystack can take a few seconds to settle; keep asking while pending.
    refetchInterval: (query) =>
      query.state.data?.status === "PENDING" && Date.now() - startedAt < POLL_FOR_MS ? 3000 : false,
  });

  useEffect(() => {
    const t = setTimeout(() => setGaveUp(true), POLL_FOR_MS);
    return () => clearTimeout(t);
  }, []);

  if (!reference) {
    return <Panel icon={<XCircle className="h-8 w-8 text-red-400" />} title="No payment to show">
      This page is opened by Paystack after you pay. <Link href="/orders" className="text-blue-400 hover:underline">See your orders</Link>.
    </Panel>;
  }
  if (isError) {
    return <Panel icon={<XCircle className="h-8 w-8 text-red-400" />} title="We couldn't check this payment">
      {error instanceof Error ? error.message : "Please try again."} Your reference is <code className="text-slate-300">{reference}</code>.
    </Panel>;
  }
  if (!data) {
    return <Panel icon={<Loader2 className="h-8 w-8 text-blue-400 animate-spin" />} title="Confirming your payment…" />;
  }

  if (data.status === "PAID") {
    return (
      <Panel icon={<CheckCircle2 className="h-8 w-8 text-green-400" />} title="Payment received">
        <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-left space-y-3">
          <Row label="Order" value={data.order?.orderNumber ?? "—"} mono />
          <Row label="Item" value={`${data.quantity} × ${data.name}`} />
          <Row label="Vendor" value={`${data.vendor.businessName}${data.vendor.city ? ` · ${data.vendor.city}` : ""}`} />
          <Row label="Paid" value={formatMoney(data.total, data.currency)} strong />
          <div className="flex items-start gap-2 text-[12px] text-slate-400 pt-1">
            {data.fulfilment === "DELIVERY" ? <Truck className="h-3.5 w-3.5 mt-px" /> : <Store className="h-3.5 w-3.5 mt-px" />}
            {data.fulfilment === "DELIVERY"
              ? `Delivery to ${data.deliveryAddress}. The vendor will contact you to arrange it.`
              : "Pickup. The vendor will contact you when it's ready."}
          </div>
        </div>
        <div className="mt-5 flex gap-2 justify-center">
          <Link href="/orders" className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-semibold text-white">My orders</Link>
          <Link href="/messages" className="rounded-lg border border-white/[0.1] px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/[0.04]">Message vendor</Link>
        </div>
      </Panel>
    );
  }

  if (data.status === "EXPIRED") {
    return <Panel icon={<Clock className="h-8 w-8 text-slate-400" />} title="This checkout expired">
      It wasn&apos;t paid within 30 minutes, so the item was released. You can search for it and buy again.
      <div className="mt-5"><Link href="/" className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-semibold text-white">Back to search</Link></div>
    </Panel>;
  }
  if (data.status === "FAILED") {
    return <Panel icon={<XCircle className="h-8 w-8 text-red-400" />} title="Payment didn't go through">
      You haven&apos;t been charged. <Link href="/" className="text-blue-400 hover:underline">Try again from search</Link>.
    </Panel>;
  }

  return (
    <Panel icon={<Loader2 className="h-8 w-8 text-blue-400 animate-spin" />} title="Confirming your payment…">
      {gaveUp
        ? <>This is taking longer than usual. If you completed payment, it will show in <Link href="/orders" className="text-blue-400 hover:underline">My orders</Link> shortly.</>
        : "This usually takes a few seconds."}
    </Panel>
  );
}

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="max-w-md mx-auto text-center rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8">
      <div className="flex justify-center mb-4">{icon}</div>
      <h1 className="text-xl font-bold text-white">{title}</h1>
      {children && <div className="text-sm text-slate-400 mt-2">{children}</div>}
    </div>
  );
}

function Row({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-[13px]">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right ${mono ? "font-mono text-slate-200" : strong ? "font-bold text-white" : "text-slate-200"}`}>{value}</span>
    </div>
  );
}

export default function CheckoutCompletePage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#040a15]">
        <Navbar />
        <main className="pt-32 pb-16 px-4">
          <Suspense fallback={<Panel icon={<Loader2 className="h-8 w-8 text-blue-400 animate-spin" />} title="Loading…" />}>
            <CheckoutResult />
          </Suspense>
        </main>
      </div>
    </AuthGuard>
  );
}
