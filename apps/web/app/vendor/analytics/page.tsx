"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi, compact, formatMoney, formatTrend } from "@/lib/vendor-api";
import { VendorSidebar } from "@/components/vendor-sidebar";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from "recharts";
import { TrendingUp, ShoppingCart, Users, Eye } from "lucide-react";

type Period = "daily" | "weekly" | "monthly";

const TT_STYLE = { backgroundColor: "#060d1f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" };
const TT_ITEM = { color: "#fff" };

/** ₦1.2M / ₦84K / ₦950 for chart axes. */
function nairaCompact(v: number): string {
  return `₦${compact(v)}`;
}

export default function VendorAnalytics() {
  const [period, setPeriod] = useState<Period>("weekly");

  const { data: analytics } = useQuery({
    queryKey: ["analytics", period],
    queryFn: () => analyticsApi.overview(period),
  });
  const { data: growth } = useQuery({ queryKey: ["analytics", "growth"], queryFn: analyticsApi.customerGrowth });
  const { data: topProducts } = useQuery({ queryKey: ["analytics", "top"], queryFn: analyticsApi.topProducts });

  const data = analytics?.series ?? [];
  const k = analytics?.kpis;

  const kpis = [
    { label: "Total Revenue", value: nairaCompact(k?.revenue.value ?? 0), trend: formatTrend(k?.revenue.trend ?? null), down: (k?.revenue.trend ?? 0) < 0, icon: TrendingUp, color: "text-green-400" },
    { label: "Orders Received", value: String(k?.orders.value ?? 0), trend: formatTrend(k?.orders.trend ?? null), down: (k?.orders.trend ?? 0) < 0, icon: ShoppingCart, color: "text-blue-400" },
    // Conversion trend is a difference in percentage points, not a ratio.
    { label: "Conversion Rate", value: `${k?.conversion.value ?? 0}%`, trend: formatTrend(k?.conversion.trend ?? null, "pt"), down: (k?.conversion.trend ?? 0) < 0, icon: TrendingUp, color: "text-cyan-400" },
    { label: "Search Appearances", value: compact(k?.views.value ?? 0), trend: formatTrend(k?.views.trend ?? null), down: (k?.views.trend ?? 0) < 0, icon: Eye, color: "text-amber-400" },
  ];

  return (
    <div className="min-h-screen flex bg-[#040a15]">
      <VendorSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-[#040a15]/95 backdrop-blur border-b border-white/[0.05] px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Analytics</h1>
            <p className="text-xs text-slate-500 mt-0.5">Performance metrics and business intelligence</p>
          </div>
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
            {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold capitalize transition-all ${period === p ? "bg-blue-600 text-white" : "text-slate-500 hover:text-white"}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="px-8 py-7 space-y-6 max-w-6xl">
          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((k) => (
              <div key={k.label} className="bg-[#06101f] border border-white/[0.07] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <k.icon className={`h-3.5 w-3.5 ${k.color}`} />
                  <span className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold">{k.label}</span>
                </div>
                <div className={`text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${k.down ? "text-red-400 bg-red-400/10" : "text-green-400 bg-green-400/10"}`}>{k.trend}</span>
                  <span className="text-[9px] text-slate-600">vs prev period</span>
                </div>
              </div>
            ))}
          </div>

          {/* Revenue Chart */}
          <div className="bg-[#06101f] border border-white/[0.07] rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white mb-1">Revenue</h3>
            <p className="text-[11px] text-slate-500 mb-5">Total earnings per {period === "daily" ? "day" : period === "weekly" ? "week" : "month"}</p>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => nairaCompact(v)} />
                  <Tooltip contentStyle={TT_STYLE} itemStyle={TT_ITEM} formatter={(v: number) => [formatMoney(v), "Revenue"]} />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revGrad)" dot={false} activeDot={{ r: 4, fill: "#3b82f6" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Orders + Customer Growth */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-[#06101f] border border-white/[0.07] rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white mb-1">Orders</h3>
              <p className="text-[11px] text-slate-500 mb-5">Orders received per period, excluding cancellations</p>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <defs>
                      <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity={1} />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.2} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TT_STYLE} itemStyle={TT_ITEM} />
                    <Bar dataKey="orders" fill="url(#ordGrad)" maxBarSize={24} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-[#06101f] border border-white/[0.07] rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white mb-1">Customer Growth</h3>
              <p className="text-[11px] text-slate-500 mb-5">New customers per month</p>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={growth ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={TT_STYLE} itemStyle={TT_ITEM} />
                    <Line type="monotone" dataKey="customers" stroke="#a78bfa" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#a78bfa" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Best Selling Products */}
          <div className="bg-[#06101f] border border-white/[0.07] rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white mb-5">Best Selling Products</h3>
            <div className="space-y-3">
              {topProducts && topProducts.length === 0 && (
                <p className="text-[12px] text-slate-600 text-center py-6">No sales yet — best sellers appear once you record orders.</p>
              )}
              {(topProducts ?? []).map((p, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                  <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-[11px] font-bold text-slate-500 shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-slate-200 truncate">{p.name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{p.units.toLocaleString()} units · {p.orders} order{p.orders === 1 ? "" : "s"}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[12px] font-semibold text-slate-300 tabular-nums">{formatMoney(p.revenue)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
