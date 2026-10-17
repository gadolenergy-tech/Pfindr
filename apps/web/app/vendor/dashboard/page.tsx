"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { VendorSidebar } from "@/components/vendor-sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Bell, Plus, Search, AlertTriangle, Zap, TrendingUp, Package, MessageSquare, RefreshCw, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import Link from "next/link";
import { api } from "@/lib/api";
import {
  analyticsApi,
  compact,
  conversationsApi,
  formatMoney,
  formatTrend,
  inventoryApi,
  ordersApi,
  timeAgo,
  type Order,
} from "@/lib/vendor-api";

const TT_STYLE = { backgroundColor: '#060d1f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' };

const REC_STYLE: Record<string, { icon: typeof Package; color: string; bg: string; border: string; cta: string }> = {
  restock: { icon: Package, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", cta: "Restock" },
  reply: { icon: MessageSquare, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", cta: "Open inbox" },
  refresh: { icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", cta: "Update stock" },
  sku: { icon: Package, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", cta: "Add SKUs" },
};

const BADGE: Record<Order["status"], "default" | "secondary" | "outline" | "destructive"> = {
  PENDING: "outline",
  CONFIRMED: "default",
  PROCESSING: "default",
  FULFILLED: "secondary",
  CANCELLED: "destructive",
  REFUNDED: "destructive",
};

function TrendPill({ trend }: { trend: number | null }) {
  const down = trend !== null && trend < 0;
  return (
    <div className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full ${
      down ? "text-red-400 bg-red-400/10" : trend === null ? "text-slate-400 bg-white/[0.05]" : "text-green-400 bg-green-400/10"
    }`}>
      {formatTrend(trend)}
    </div>
  );
}

export default function VendorDashboard() {
  const router = useRouter();
  const [orderSearch, setOrderSearch] = useState("");

  const { data: analytics } = useQuery({
    queryKey: ["analytics", "daily"],
    queryFn: () => analyticsApi.overview("daily"),
  });
  const { data: weekly } = useQuery({
    queryKey: ["analytics", "weekly"],
    queryFn: () => analyticsApi.overview("weekly"),
  });
  const { data: inventory } = useQuery({ queryKey: ["inventory", "summary"], queryFn: inventoryApi.summary });
  const { data: orderSummary } = useQuery({ queryKey: ["orders", "summary"], queryFn: ordersApi.summary });
  const { data: recentOrders } = useQuery({ queryKey: ["orders", "recent"], queryFn: () => ordersApi.list("?limit=5") });
  const { data: lowStock } = useQuery({
    queryKey: ["inventory", "low"],
    queryFn: () => inventoryApi.list("?limit=5&sort=quantity&order=asc&status=LOW_STOCK"),
  });
  const { data: outOfStock } = useQuery({
    queryKey: ["inventory", "out"],
    queryFn: () => inventoryApi.list("?limit=5&status=OUT_OF_STOCK"),
  });
  const { data: recs } = useQuery({ queryKey: ["analytics", "recs"], queryFn: analyticsApi.recommendations });
  const { data: unread } = useQuery({
    queryKey: ["conversations", "unread"],
    queryFn: conversationsApi.unreadCount,
    refetchInterval: 15_000,
  });
  const { data: vendor } = useQuery({
    queryKey: ["vendor", "me"],
    queryFn: () => api.get<{ status: string; listingPaused: boolean; businessName: string }>("/vendors/me"),
  });

  const daily = analytics?.series ?? [];
  const sparkline = (key: "views" | "orders" | "revenue") => {
    const values = daily.slice(-5).map((d) => d[key]);
    const max = Math.max(1, ...values);
    return values.map((v) => Math.max(6, Math.round((v / max) * 100)));
  };

  const alerts = [...(outOfStock ?? []), ...(lowStock ?? [])].slice(0, 5);

  function searchOrders(event: FormEvent) {
    event.preventDefault();
    router.push(`/vendor/orders${orderSearch.trim() ? `?q=${encodeURIComponent(orderSearch.trim())}` : ""}`);
  }

  const stats = [
    {
      title: "Total Inventory",
      value: compact(inventory?.totalUnits ?? 0),
      sub: `${inventory?.totalItems ?? 0} products listed`,
      trend: null as number | null,
      showTrend: false,
      bars: sparkline("views"),
    },
    {
      title: "Active Orders",
      value: String((orderSummary?.pending ?? 0) + (orderSummary?.processing ?? 0)),
      sub: `${formatMoney(orderSummary?.openValue ?? 0)} in flight`,
      trend: analytics?.kpis.orders.trend ?? null,
      showTrend: true,
      bars: sparkline("orders"),
    },
    {
      title: "Total Revenue",
      value: formatMoney(orderSummary?.revenue ?? 0),
      sub: "fulfilled, all time",
      trend: analytics?.kpis.revenue.trend ?? null,
      showTrend: true,
      bars: sparkline("revenue"),
    },
    {
      title: "Search Appearances",
      value: compact(analytics?.kpis.views.value ?? 0),
      sub: "last 7 days",
      trend: analytics?.kpis.views.trend ?? null,
      showTrend: true,
      bars: sparkline("views"),
    },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <VendorSidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-8 border-b border-white/[0.06] bg-[#040a15]/90 backdrop-blur-xl z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <div className="font-semibold text-lg text-white">Dashboard Overview</div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <div className={`w-1.5 h-1.5 rounded-full ${vendor?.listingPaused ? "bg-amber-400" : "bg-green-400 animate-pulse shadow-[0_0_6px_rgba(74,222,128,0.5)]"}`} />
              <span>{vendor?.listingPaused ? "Listings Paused" : "Network Live"}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <form onSubmit={searchOrders} className="relative hidden md:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} placeholder="Search orders..." className="pl-9 bg-white/[0.03] border-white/[0.06] w-64 text-slate-200 placeholder:text-slate-500" />
            </form>
            <Button asChild variant="outline" size="icon" className="rounded-full relative border-white/[0.06] hover:bg-white/[0.05] text-slate-300">
              <Link href="/vendor/messages" aria-label={`${unread?.unread ?? 0} unread messages`}>
                <Bell className="h-4 w-4" />
                {(unread?.unread ?? 0) > 0 && (
                  <span className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full"></span>
                )}
              </Link>
            </Button>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto space-y-8 bg-[#040a15]">
          {vendor && vendor.status !== "VERIFIED" && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-5 py-4">
              <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-amber-200">
                  {vendor.status === "PENDING" ? "Verification in progress" : `Account ${vendor.status.toLowerCase()}`}
                </div>
                <p className="text-[12px] text-amber-200/70 mt-0.5">
                  {vendor.status === "PENDING"
                    ? "You can build your inventory now. It becomes visible in buyer search once the Finder team verifies your business."
                    : "Your products are not visible in search. Contact support to resolve this."}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <Card key={i} className="bg-[#06101f] border-white/[0.07] rounded-2xl">
                <CardHeader className="pb-2">
                  <CardDescription className="text-[11px] uppercase tracking-wider text-slate-500">{stat.title}</CardDescription>
                  <CardTitle className="text-3xl text-white truncate">{stat.value}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center">
                    {stat.showTrend && <TrendPill trend={stat.trend} />}
                    <span className={`text-xs text-slate-500 ${stat.showTrend ? "ml-2" : ""}`}>
                      {stat.showTrend ? "vs previous 7 days" : stat.sub}
                    </span>
                  </div>
                  <div className="flex items-end gap-0.5 mt-3 h-8">
                    {(stat.bars.length ? stat.bars : [6, 6, 6, 6, 6]).map((h, j) => (
                      <div key={j} className="flex-1 rounded-sm bg-blue-500/30" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <Card className="bg-[#06101f] border-white/[0.07] rounded-2xl">
              <CardHeader>
                <CardTitle className="text-white">Search Appearances</CardTitle>
                <CardDescription className="text-slate-400">How often your products appeared in buyer searches, last 7 days</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.2} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(value: number) => compact(value)} />
                    <Tooltip cursor={{fill: 'rgba(255,255,255,0.02)'}} contentStyle={TT_STYLE} itemStyle={{ color: '#fff' }} />
                    <Bar dataKey="views" name="Appearances" fill="url(#barGradient)" maxBarSize={28} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-[#06101f] border-white/[0.07] rounded-2xl">
              <CardHeader>
                <CardTitle className="text-white">Profile Views</CardTitle>
                <CardDescription className="text-slate-400">Buyers opening your vendor page, last 4 weeks</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weekly?.series ?? []}>
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TT_STYLE} itemStyle={{ color: '#fff' }} />
                    <Area type="monotone" dataKey="profileViews" name="Profile views" stroke="#3b82f6" strokeWidth={2} fill="url(#areaGradient)" fillOpacity={1} dot={false} activeDot={{ r: 4, fill: '#3b82f6' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Low-Stock Alerts */}
            <Card className="bg-[#06101f] border-white/[0.07] rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    Low-Stock Alerts
                  </CardTitle>
                  <CardDescription className="text-slate-500 text-[11px] mt-0.5">Products needing restocking</CardDescription>
                </div>
                <Button asChild size="sm" variant="ghost" className="text-blue-400 hover:text-blue-300 text-[11px] h-7 px-2 gap-1">
                  <Link href="/vendor/inventory"><RefreshCw className="h-3 w-3" /> Sync</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {alerts.length === 0 && (
                  <p className="text-[12px] text-slate-600 text-center py-8">Everything is well stocked.</p>
                )}
                {alerts.map((item) => {
                  // Bar is stock relative to the vendor's own low-stock threshold.
                  const pct = Math.min(100, Math.round((item.quantity / Math.max(1, item.lowStockThreshold)) * 100));
                  const isCritical = item.status === "OUT_OF_STOCK" || pct <= 30;
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all duration-150">
                      <div className={`w-1.5 h-8 rounded-full shrink-0 ${isCritical ? "bg-red-500/80" : "bg-amber-500/80"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-slate-200 truncate">{item.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${isCritical ? "bg-red-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`text-[10px] font-semibold tabular-nums shrink-0 ${isCritical ? "text-red-400" : "text-amber-400"}`}>
                            {item.quantity === 0 ? "Out of stock" : `${item.quantity} left`}
                          </span>
                        </div>
                      </div>
                      <div className="text-[9px] text-slate-600 shrink-0">{timeAgo(item.updatedAt)}</div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Recommendations — rule-based, driven by the vendor's own data */}
            <Card className="bg-[#06101f] border-white/[0.07] rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-blue-400" />
                  Recommendations
                </CardTitle>
                <CardDescription className="text-slate-500 text-[11px] mt-0.5">Actions to grow your visibility, from your live data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recs && recs.length === 0 && (
                  <p className="text-[12px] text-slate-600 text-center py-8">Nothing needs your attention right now.</p>
                )}
                {(recs ?? []).map((rec, i) => {
                  const style = REC_STYLE[rec.kind] ?? REC_STYLE.sku!;
                  return (
                    <div key={i} className={`p-4 rounded-xl border ${style.border} bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-150`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${style.bg} border ${style.border}`}>
                          <style.icon className={`h-4 w-4 ${style.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-semibold text-slate-200 mb-1">{rec.title}</div>
                          <p className="text-[11px] text-slate-500 leading-relaxed mb-2">{rec.detail}</p>
                          <Link href={rec.href} className={`text-[10px] font-semibold ${style.color} hover:underline inline-flex items-center gap-1`}>
                            {style.cta} →
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-[#06101f] border-white/[0.07] rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white">Recent Orders</CardTitle>
                <CardDescription className="text-slate-400">Your latest recorded orders</CardDescription>
              </div>
              <Button asChild size="sm" className="gap-2 bg-blue-600 hover:bg-blue-500 text-white">
                <Link href="/vendor/inventory"><Plus className="h-4 w-4" /> Add Product</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentOrders && recentOrders.length === 0 ? (
                <p className="text-[12px] text-slate-600 text-center py-8">
                  No orders yet. <Link href="/vendor/orders" className="text-blue-400 hover:underline">Record one</Link> when you close a sale.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="text-slate-400">Order ID</TableHead>
                      <TableHead className="text-slate-400">Buyer</TableHead>
                      <TableHead className="text-slate-400">Items</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-right text-slate-400">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(recentOrders ?? []).map((order) => (
                      <TableRow key={order.id} className="border-white/[0.06] hover:bg-white/[0.02] cursor-pointer"
                        onClick={() => router.push(`/vendor/orders?q=${order.orderNumber}`)}>
                        <TableCell className="font-medium text-slate-200">{order.orderNumber}</TableCell>
                        <TableCell className="text-slate-300">{order.customer?.company || order.customer?.fullName || "—"}</TableCell>
                        <TableCell className="text-slate-400">
                          {order.items[0] ? `${order.items[0].quantity}x ${order.items[0].name}` : "—"}
                          {order.items.length > 1 && ` +${order.items.length - 1}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant={BADGE[order.status]}>{order.status.charAt(0) + order.status.slice(1).toLowerCase()}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-200">{formatMoney(order.total, order.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
