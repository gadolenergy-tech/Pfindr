"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { VendorSidebar } from "@/components/vendor-sidebar";
import { Input } from "@/components/ui/input";
import { Search, TrendingUp, Users, Repeat, ShoppingBag, Loader2 } from "lucide-react";
import {
  customersApi,
  formatDate,
  formatMoney,
  type Customer,
} from "@/lib/vendor-api";

const TIER_CONFIG = {
  Gold: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  Silver: { color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20" },
  Bronze: { color: "text-amber-700", bg: "bg-amber-900/10", border: "border-amber-700/20" },
};

/** Tier by lifetime spend with this vendor. */
function tierOf(c: Customer): keyof typeof TIER_CONFIG {
  if (c.totalSpent >= 10_000_000) return "Gold";
  if (c.totalSpent >= 2_000_000) return "Silver";
  return "Bronze";
}

export default function VendorCustomers() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { data: summary } = useQuery({
    queryKey: ["customers", "summary"],
    queryFn: customersApi.summary,
  });

  const params = new URLSearchParams({ limit: "100" });
  if (search.trim()) params.set("q", search.trim());

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers", "list", search],
    queryFn: () => customersApi.list(`?${params.toString()}`),
  });

  const { data: selectedCustomer, isFetching: loadingDetail } = useQuery({
    queryKey: ["customers", "detail", selected],
    queryFn: () => customersApi.get(selected!),
    enabled: Boolean(selected),
  });

  const metrics = [
    { label: "Total Customers", value: String(summary?.total ?? 0), icon: Users, color: "text-blue-400" },
    { label: "Active (90 days)", value: String(summary?.active ?? 0), icon: TrendingUp, color: "text-green-400" },
    { label: "Repeat Buyers", value: String(summary?.repeat ?? 0), icon: Repeat, color: "text-cyan-400" },
    { label: "Total Orders", value: String(summary?.totalOrders ?? 0), icon: ShoppingBag, color: "text-amber-400" },
  ];

  return (
    <div className="min-h-screen flex bg-[#040a15]">
      <VendorSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-[#040a15]/95 backdrop-blur border-b border-white/[0.05] px-8 py-4">
          <h1 className="text-lg font-bold text-white">Customers</h1>
          <p className="text-xs text-slate-500 mt-0.5">Customer directory and retention metrics</p>
        </div>

        <div className="px-8 py-7 max-w-6xl space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((m) => (
              <div key={m.label} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <m.icon className={`h-3.5 w-3.5 ${m.color}`} />
                  <span className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold">{m.label}</span>
                </div>
                <div className={`text-2xl font-bold tabular-nums ${m.color}`}>{m.value}</div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Customer List */}
            <div className="lg:col-span-2 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers…"
                  className="pl-9 bg-white/[0.03] border-white/[0.07] text-slate-200 placeholder:text-slate-600 h-9" />
              </div>
              <div className="space-y-2">
                {isLoading &&
                  [0, 1, 2].map((i) => (
                    <div key={i} className="h-[66px] bg-white/[0.02] border border-white/[0.05] rounded-2xl animate-pulse" />
                  ))}
                {!isLoading && (customers ?? []).length === 0 && (
                  <div className="text-center py-12 text-slate-600 text-sm">
                    {search
                      ? "No customers match that search."
                      : "No customers yet. They are added when you record an order."}
                  </div>
                )}
                {(customers ?? []).map((c) => {
                  const tierName = tierOf(c);
                  const tier = TIER_CONFIG[tierName];
                  const isActive = selected === c.id;
                  return (
                    <button key={c.id}
                      onClick={() => {
                        setSelected(isActive ? null : c.id);
                        setShowHistory(false);
                      }}
                      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border text-left transition-all ${isActive ? "bg-blue-500/[0.08] border-blue-500/20" : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]"}`}>
                      <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/[0.08] flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-slate-300">{c.fullName[0]?.toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-200 truncate">{c.company || c.fullName}</span>
                          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${tier.bg} ${tier.border} ${tier.color} shrink-0`}>{tierName}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{c.email ?? c.phone ?? "No contact details"}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[12px] font-semibold text-slate-300 tabular-nums">{c.totalOrders} orders</div>
                        <div className={`text-[9px] font-medium ${c.active ? "text-green-400" : "text-slate-600"}`}>{c.active ? "Active" : "Inactive"}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Customer Profile Panel */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
              {selected && !selectedCustomer && loadingDetail ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
                </div>
              ) : selectedCustomer ? (
                <div className="space-y-5">
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-blue-500/20 flex items-center justify-center mx-auto mb-3">
                      <span className="text-xl font-bold text-slate-300">{selectedCustomer.fullName[0]?.toUpperCase()}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white">{selectedCustomer.fullName}</h3>
                    {selectedCustomer.company && <p className="text-[11px] text-slate-400">{selectedCustomer.company}</p>}
                    <p className="text-[11px] text-slate-500">{selectedCustomer.email ?? selectedCustomer.phone ?? ""}</p>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: "Total Orders", value: selectedCustomer.totalOrders.toString() },
                      { label: "Total Spent", value: formatMoney(selectedCustomer.totalSpent) },
                      { label: "Last Order", value: formatDate(selectedCustomer.lastOrderAt) },
                      { label: "Buyer Tier", value: tierOf(selectedCustomer) },
                      { label: "Repeat Buyer", value: selectedCustomer.repeat ? "Yes" : "No" },
                      { label: "Status", value: selectedCustomer.active ? "Active" : "Inactive" },
                    ].map((d) => (
                      <div key={d.label} className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-600">{d.label}</span>
                        <span className="text-[12px] font-semibold text-slate-300">{d.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 border-t border-white/[0.06] space-y-2">
                    {selectedCustomer.email ? (
                      <a href={`mailto:${selectedCustomer.email}`}
                        className="block text-center w-full py-2 text-[11px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-xl hover:bg-blue-500/15 transition-colors">
                        Send Email
                      </a>
                    ) : selectedCustomer.phone ? (
                      <a href={`tel:${selectedCustomer.phone}`}
                        className="block text-center w-full py-2 text-[11px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-xl hover:bg-blue-500/15 transition-colors">
                        Call Customer
                      </a>
                    ) : null}
                    <button onClick={() => setShowHistory(!showHistory)}
                      className="w-full py-2 text-[11px] font-semibold text-slate-400 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:bg-white/[0.05] transition-colors">
                      {showHistory ? "Hide Order History" : "View Order History"}
                    </button>
                    {showHistory && (
                      <div className="space-y-1.5 pt-1">
                        {selectedCustomer.recentOrders.length === 0 && (
                          <p className="text-[11px] text-slate-600 text-center py-2">No orders yet.</p>
                        )}
                        {selectedCustomer.recentOrders.map((o) => (
                          <div key={o.id} className="flex items-center justify-between text-[11px] px-3 py-2 bg-white/[0.02] rounded-lg">
                            <span className="text-slate-300 font-mono">{o.orderNumber}</span>
                            <span className="text-slate-500">{o.status.toLowerCase()}</span>
                            <span className="text-slate-300 tabular-nums">{formatMoney(o.total, o.currency)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <Users className="h-8 w-8 text-slate-700 mb-3" />
                  <p className="text-sm text-slate-600">Select a customer to view their profile</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
