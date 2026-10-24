"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { VendorSidebar } from "@/components/vendor-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Download, ChevronRight, Clock, CheckCircle2, XCircle, RefreshCw, Plus, Loader2 } from "lucide-react";
import { RecordOrderDialog } from "@/components/orders/record-order-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  formatDate,
  formatMoney,
  ordersApi,
  type Order,
  type OrderStatusApi,
} from "@/lib/vendor-api";

type OrderStatus = "Pending" | "Processing" | "Completed" | "Cancelled";

/** The page groups the API's six states into the four the design shows. */
const GROUP: Record<OrderStatusApi, OrderStatus> = {
  PENDING: "Pending",
  CONFIRMED: "Processing",
  PROCESSING: "Processing",
  FULFILLED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Cancelled",
};

/** Which API status each tab filters on. Processing covers two, so it filters client-side. */
const TAB_FILTER: Record<OrderStatus, OrderStatusApi | null> = {
  Pending: "PENDING",
  Processing: null,
  Completed: "FULFILLED",
  Cancelled: null,
};

const STATUS_CONFIG: Record<OrderStatus, { color: string; bg: string; border: string; icon: React.ComponentType<{ className?: string }> }> = {
  Pending: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: Clock },
  Processing: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: RefreshCw },
  Completed: { color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", icon: CheckCircle2 },
  Cancelled: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: XCircle },
};

const TABS: OrderStatus[] = ["Pending", "Processing", "Completed", "Cancelled"];

function productLine(order: Order): string {
  const [first, ...rest] = order.items;
  if (!first) return "—";
  const head = `${first.name} × ${first.quantity.toLocaleString()}`;
  return rest.length ? `${head} + ${rest.length} more` : head;
}

function exportOrdersCsv(orders: Order[]) {
  const escape = (v: string | number | null) => {
    const text = v === null ? "" : String(v);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [
    "order_number,status,placed_at,customer,company,items,total,currency",
    ...orders.map((o) =>
      [
        o.orderNumber,
        o.status,
        o.placedAt,
        o.customer?.fullName ?? "",
        o.customer?.company ?? "",
        o.items.map((i) => `${i.name} x${i.quantity}`).join("; "),
        o.total,
        o.currency,
      ].map(escape).join(","),
    ),
  ];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `finder-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function OrdersView() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<OrderStatus | "All">("All");
  // The dashboard deep-links here with ?q=ORD-… to open on one order.
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: summary } = useQuery({
    queryKey: ["orders", "summary"],
    queryFn: ordersApi.summary,
  });

  const params = new URLSearchParams({ limit: "100" });
  if (search.trim()) params.set("q", search.trim());
  const apiStatus = tab === "All" ? null : TAB_FILTER[tab];
  if (apiStatus) params.set("status", apiStatus);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", "list", search, tab],
    queryFn: () => ordersApi.list(`?${params.toString()}`),
  });

  const filtered = (orders ?? []).filter((o) => tab === "All" || GROUP[o.status] === tab);

  const counts: Record<OrderStatus, number> = {
    Pending: summary?.pending ?? 0,
    Processing: summary?.processing ?? 0,
    Completed: summary?.fulfilled ?? 0,
    Cancelled: summary?.cancelled ?? 0,
  };

  const transition = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatusApi }) =>
      ordersApi.setStatus(id, status),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: `${order.orderNumber} is now ${GROUP[order.status].toLowerCase()}` });
    },
    onError: (err: Error) =>
      toast({ title: "Could not update order", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="min-h-screen flex bg-[#040a15]">
      <VendorSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-[#040a15]/95 backdrop-blur border-b border-white/[0.05] px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Orders</h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage and track all procurement orders</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={!orders?.length}
              onClick={() => orders && exportOrdersCsv(orders)}
              className="text-slate-400 hover:text-white gap-2"
            >
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button size="sm" onClick={() => setRecording(true)} className="bg-blue-600 hover:bg-blue-500 gap-2">
              <Plus className="h-4 w-4" /> Record order
            </Button>
          </div>
        </div>

        <div className="px-8 py-7 space-y-6 max-w-6xl">
          {/* Stat Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {TABS.map((t) => {
              const cfg = STATUS_CONFIG[t];
              return (
                <div key={t} className={`p-4 rounded-2xl border cursor-pointer transition-all ${tab === t ? `${cfg.bg} ${cfg.border}` : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"}`}
                  onClick={() => setTab(tab === t ? "All" : t)}>
                  <div className="flex items-center gap-2 mb-1">
                    <cfg.icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                    <span className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold">{t}</span>
                  </div>
                  <div className={`text-2xl font-bold tabular-nums ${cfg.color}`}>{counts[t]}</div>
                </div>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders, buyers, products…"
                className="pl-9 bg-white/[0.03] border-white/[0.07] text-slate-200 placeholder:text-slate-600 h-9" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(["All", ...TABS] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${tab === t ? "bg-blue-600 text-white" : "bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.06]"}`}>
                  {t}
                </button>
              ))}
            </div>
            {summary && summary.revenue > 0 && (
              <div className="ml-auto text-[11px] text-slate-500">
                Fulfilled revenue <span className="text-green-400 font-semibold tabular-nums">{formatMoney(summary.revenue)}</span>
              </div>
            )}
          </div>

          {/* Orders List */}
          <div className="space-y-2">
            {isLoading &&
              [0, 1, 2].map((i) => (
                <div key={i} className="h-[72px] bg-white/[0.02] border border-white/[0.06] rounded-2xl animate-pulse" />
              ))}
            {!isLoading && filtered.length === 0 && (
              <div className="text-center py-12 space-y-3">
                <p className="text-slate-600 text-sm">
                  {search || tab !== "All" ? "No orders match this filter" : "No orders yet"}
                </p>
                {!search && tab === "All" && (
                  <Button size="sm" variant="outline" onClick={() => setRecording(true)} className="border-white/[0.08] text-slate-300">
                    <Plus className="h-4 w-4 mr-1" /> Record your first order
                  </Button>
                )}
              </div>
            )}
            {filtered.map((order) => {
              const group = GROUP[order.status];
              const cfg = STATUS_CONFIG[group];
              const isOpen = expanded === order.id;
              const busy = transition.isPending && transition.variables?.id === order.id;
              return (
                <div key={order.id} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
                  <button className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition-all text-left"
                    onClick={() => setExpanded(isOpen ? null : order.id)}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg} border ${cfg.border}`}>
                      <cfg.icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-white">{order.orderNumber}</span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                          {order.status === "REFUNDED" ? "Refunded" : group}
                        </span>
                        {order.source === "CHECKOUT" && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-green-500/25 bg-green-500/10 text-green-300">
                            Paid online
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {order.customer?.company || order.customer?.fullName || "Walk-in customer"} · {productLine(order)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-white tabular-nums">{formatMoney(order.total, order.currency)}</div>
                      <div className="text-[10px] text-slate-600">{formatDate(order.placedAt)}</div>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-slate-600 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 border-t border-white/[0.05]">
                      <div className="grid sm:grid-cols-3 gap-4 mt-3">
                        {[
                          { label: "Buyer", value: order.customer?.fullName ?? "—" },
                          { label: "Phone", value: order.customer?.phone ?? "—" },
                          { label: "Order Date", value: formatDate(order.placedAt) },
                          { label: "Email", value: order.customer?.email ?? "—" },
                          { label: "Total Value", value: formatMoney(order.total, order.currency) },
                          { label: "Items", value: `${order.items.length} item${order.items.length > 1 ? "s" : ""}` },
                        ].map((d) => (
                          <div key={d.label}>
                            <div className="text-[9px] uppercase tracking-widest text-slate-600 font-semibold mb-1">{d.label}</div>
                            <div className="text-[12px] text-slate-300">{d.value}</div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 border border-white/[0.05] rounded-xl divide-y divide-white/[0.04]">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between px-4 py-2.5 text-[12px]">
                            <span className="text-slate-300 flex items-center gap-2.5">
                              {item.imageUrl && (
                                // eslint-disable-next-line @next/next/no-img-element -- bucket host is configured per environment
                                <img src={item.imageUrl} alt="" className="w-8 h-8 rounded-md object-cover border border-white/[0.06]" />
                              )}
                              <span>
                                {item.name}
                                {item.brand && <span className="text-slate-500"> · {item.brand}</span>}
                              </span>
                              {item.sku && <span className="text-slate-600 ml-2 font-mono text-[10px]">{item.sku}</span>}
                            </span>
                            <span className="text-slate-400 tabular-nums">
                              {item.quantity.toLocaleString()} × {formatMoney(item.unitPrice, order.currency)} ={" "}
                              <span className="text-white font-semibold">{formatMoney(item.lineTotal, order.currency)}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                      {order.source === "CHECKOUT" && (
                        <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[11px] text-slate-400 space-y-1">
                          <div>
                            <span className="text-slate-500">Handover: </span>
                            {order.fulfilment === "DELIVERY" ? `Delivery to ${order.deliveryAddress ?? "—"}` : "Buyer picks up from you"}
                          </div>
                          {order.buyerPhone && <div><span className="text-slate-500">Buyer phone: </span>{order.buyerPhone}</div>}
                          {order.paidAt && <div><span className="text-slate-500">Paid: </span>{formatDate(order.paidAt)} · ref {order.paymentReference}</div>}
                        </div>
                      )}
                      {order.note && <p className="text-[11px] text-slate-500 mt-3">Note: {order.note}</p>}

                      <div className="flex gap-2 mt-5 items-center">
                        {order.status === "PENDING" && (
                          <Button size="sm" disabled={busy} onClick={() => transition.mutate({ id: order.id, status: "PROCESSING" })}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-[11px] h-8">Accept Order</Button>
                        )}
                        {(order.status === "CONFIRMED" || order.status === "PROCESSING") && (
                          <Button size="sm" disabled={busy} onClick={() => transition.mutate({ id: order.id, status: "FULFILLED" })}
                            className="bg-green-600 hover:bg-green-500 text-white text-[11px] h-8">Mark as Fulfilled</Button>
                        )}
                        {group !== "Cancelled" && group !== "Completed" && (
                          <Button size="sm" variant="ghost" disabled={busy}
                            onClick={() => {
                              if (window.confirm(`Cancel ${order.orderNumber}? The items go back into stock.`)) {
                                transition.mutate({ id: order.id, status: "CANCELLED" });
                              }
                            }}
                            className="text-red-400 hover:text-red-300 text-[11px] h-8">Cancel Order</Button>
                        )}
                        {order.status === "FULFILLED" && (
                          <Button size="sm" variant="ghost" disabled={busy}
                            onClick={() => {
                              if (window.confirm(`Refund ${order.orderNumber}? The items go back into stock.`)) {
                                transition.mutate({ id: order.id, status: "REFUNDED" });
                              }
                            }}
                            className="text-slate-400 hover:text-white text-[11px] h-8">Refund</Button>
                        )}
                        {busy && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <RecordOrderDialog open={recording} onOpenChange={setRecording} />
    </div>
  );
}

export default function VendorOrders() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#040a15]" />}>
      <OrdersView />
    </Suspense>
  );
}
