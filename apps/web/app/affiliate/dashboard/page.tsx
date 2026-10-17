"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import Link from "next/link";
import { Copy, TrendingUp, Users, DollarSign, MousePointer, CheckCircle2, ExternalLink, Download, Loader2, Info } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, CartesianGrid, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { compact, formatDate, formatMoney } from "@/lib/vendor-api";

type AffiliateMe = {
  affiliate: {
    id: string;
    code: string;
    status: "PENDING" | "ACTIVE" | "SUSPENDED";
    link: string;
    payoutEmail: string;
    commissionRate: number;
    balance: number;
    available: number;
    totalEarned: number;
    clicks: number;
    createdAt: string;
  } | null;
  tier?: { name: string; rate: number; next: { name: string; needed: number } | null };
  stats?: { signups: number; converted: number; pending: number; conversionRate: number };
  earnings?: { name: string; earnings: number }[];
  referrals?: { id: string; name: string; type: string; status: string; joined: string; commission: number }[];
  payouts?: { id: string; amount: number; method: string; status: string; requestedAt: string; paidAt: string | null }[];
};

const TT_STYLE = { backgroundColor: "#060d1f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" };
const MIN_PAYOUT = 5_000;

function exportReport(data: AffiliateMe) {
  const escape = (v: string | number) => {
    const t = String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const lines = [
    "name,type,status,joined,commission",
    ...(data.referrals ?? []).map((r) => [r.name, r.type, r.status, r.joined, r.commission].map(escape).join(",")),
  ];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `finder-referrals-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AffiliateDashboard() {
  const [copied, setCopied] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"BANK_TRANSFER" | "PAYSTACK">("BANK_TRANSFER");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["affiliate", "me"],
    queryFn: () => api.get<AffiliateMe>("/affiliate/me"),
  });

  // Not an affiliate yet: send them to the join form.
  useEffect(() => {
    if (data && !data.affiliate) router.replace("/affiliate/join");
  }, [data, router]);

  const withdraw = useMutation({
    mutationFn: () => api.post("/affiliate/payouts", { amount: Number(amount), method }),
    onSuccess: () => {
      setWithdrawOpen(false);
      setAmount("");
      void queryClient.invalidateQueries({ queryKey: ["affiliate"] });
      toast({ title: "Withdrawal requested", description: "Payouts are processed by the Finder team." });
    },
    onError: (err: Error) => toast({ title: "Request failed", description: err.message, variant: "destructive" }),
  });

  const aff = data?.affiliate;

  if (isLoading || !aff) {
    return (
      <div className="min-h-screen bg-[#040a15] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(aff.link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stats = data.stats!;
  const kpis = [
    { label: "Total Earnings", value: formatMoney(aff.totalEarned), sub: `${Math.round(aff.commissionRate * 100)}% commission rate`, icon: DollarSign, color: "text-green-400" },
    { label: "Active Referrals", value: String(stats.converted), sub: `${stats.pending} pending`, icon: Users, color: "text-blue-400" },
    { label: "Total Clicks", value: compact(aff.clicks), sub: "All time", icon: MousePointer, color: "text-amber-400" },
    { label: "Conversion Rate", value: `${stats.conversionRate}%`, sub: "Signups per click", icon: TrendingUp, color: "text-cyan-400" },
  ];

  const pendingPayout = (data.payouts ?? []).find((p) => p.status === "PENDING");

  return (
    <div className="min-h-screen bg-[#040a15] text-white">
      <Navbar />
      <div className="pt-28 pb-20 px-4">
        <div className="container mx-auto max-w-5xl space-y-8">
          {/* Header */}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-1.5 h-1.5 rounded-full ${aff.status === "ACTIVE" ? "bg-green-400 animate-pulse" : "bg-amber-400"}`} />
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                  {data.tier!.name} Tier{aff.status !== "ACTIVE" ? ` · ${aff.status.toLowerCase()}` : ""}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white">Affiliate Dashboard</h1>
              <p className="text-slate-500 text-sm mt-1">Affiliate ID: <span className="text-slate-300 font-mono">{aff.code}</span></p>
              {data.tier!.next && (
                <p className="text-[11px] text-slate-500 mt-1">
                  {data.tier!.next.needed} more active referral{data.tier!.next.needed === 1 ? "" : "s"} to reach {data.tier!.next.name}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Button asChild size="sm" variant="ghost" className="text-slate-400 hover:text-white gap-2 border border-white/[0.06]">
                <Link href="/affiliate"><ExternalLink className="h-4 w-4" /> Program Info</Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => exportReport(data)} disabled={!data.referrals?.length}
                className="text-slate-400 hover:text-white gap-2 border border-white/[0.06]">
                <Download className="h-4 w-4" /> Export Report
              </Button>
            </div>
          </div>

          {/* Referral Link Generator */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-3">Your Referral Link</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-[#030810] border border-white/[0.07] rounded-xl px-4 py-3 font-mono text-[12px] text-blue-300 truncate">
                {aff.link}
              </div>
              <button onClick={handleCopy}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[11px] font-semibold transition-all shrink-0 ${copied ? "bg-green-500/15 border border-green-500/25 text-green-400" : "bg-blue-500/15 border border-blue-500/25 text-blue-400 hover:bg-blue-500/25"}`}>
                {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy Link"}
              </button>
            </div>
            <p className="text-[10px] text-slate-600 mt-2">Anyone who signs up within 90 days of clicking this link is credited to you.</p>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((k) => (
              <div key={k.label} className="bg-[#06101f] border border-white/[0.07] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <k.icon className={`h-3.5 w-3.5 ${k.color}`} />
                  <span className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold">{k.label}</span>
                </div>
                <div className={`text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</div>
                <div className="text-[9px] text-slate-600 mt-0.5">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Earnings Chart */}
          <div className="bg-[#06101f] border border-white/[0.07] rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white mb-1">Earnings History</h3>
            <p className="text-[11px] text-slate-500 mb-5">Monthly commission earnings (₦)</p>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.earnings ?? []}>
                  <defs>
                    <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => `₦${compact(v)}`} />
                  <Tooltip contentStyle={TT_STYLE} itemStyle={{ color: "#fff" }} formatter={(v: number) => [formatMoney(v), "Earnings"]} />
                  <Area type="monotone" dataKey="earnings" stroke="#10b981" strokeWidth={2} fill="url(#earnGrad)" dot={false} activeDot={{ r: 4, fill: "#10b981" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Referrals Table */}
          <div className="bg-[#06101f] border border-white/[0.07] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-semibold text-white">Your Referrals</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">A referral becomes active when the vendor is verified or the user confirms their email</p>
              </div>
            </div>
            <div className="space-y-2">
              {(data.referrals ?? []).length === 0 && (
                <p className="text-[12px] text-slate-600 text-center py-8">No referrals yet — share your link to get started.</p>
              )}
              {(data.referrals ?? []).map((r) => (
                <div key={r.id} className="flex items-center gap-4 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/[0.08] flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-bold text-slate-400">{r.name[0]?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-slate-200 truncate">{r.name}</div>
                    <div className="text-[10px] text-slate-500">{r.type} · Joined {formatDate(r.joined)}</div>
                  </div>
                  <div className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${r.status === "Active" ? "text-green-400 bg-green-500/10 border-green-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20"}`}>
                    {r.status}
                  </div>
                  <div className="text-[12px] font-semibold text-slate-300 shrink-0 tabular-nums w-28 text-right">
                    {r.commission > 0 ? formatMoney(r.commission) : "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Withdraw */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Available Balance</h3>
                <div className="text-3xl font-bold text-green-400 tabular-nums mt-1">{formatMoney(aff.available)}</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {pendingPayout
                    ? `${formatMoney(pendingPayout.amount)} withdrawal pending since ${formatDate(pendingPayout.requestedAt)}`
                    : `Withdrawable · minimum ${formatMoney(MIN_PAYOUT)} · paid to ${aff.payoutEmail}`}
                </p>
              </div>
              <Button
                onClick={() => setWithdrawOpen(true)}
                disabled={aff.available < MIN_PAYOUT || aff.status !== "ACTIVE"}
                className="bg-green-600 hover:bg-green-500 text-white gap-2"
              >
                <DollarSign className="h-4 w-4" /> Request Withdrawal
              </Button>
            </div>
            <div className="flex items-start gap-2 text-[11px] text-slate-500">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Commission is credited to your balance by the Finder team as referred vendors start paying for Finder.
            </div>
            {(data.payouts ?? []).length > 0 && (
              <div className="border-t border-white/[0.05] pt-3 space-y-1.5">
                {(data.payouts ?? []).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">{formatDate(p.requestedAt)} · {p.method === "PAYSTACK" ? "Paystack" : "Bank transfer"}</span>
                    <span className={p.status === "PAID" ? "text-green-400" : p.status === "FAILED" ? "text-red-400" : "text-amber-400"}>
                      {p.status.toLowerCase()}
                    </span>
                    <span className="text-slate-300 tabular-nums">{formatMoney(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="bg-[#060d1f] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-white">Request a withdrawal</DialogTitle>
            <DialogDescription>Up to {formatMoney(aff.available)} is available.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input
              type="number"
              min={MIN_PAYOUT}
              max={aff.available}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Amount (min ${MIN_PAYOUT.toLocaleString()})`}
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/40"
            />
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-slate-300 outline-none"
            >
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="PAYSTACK">Paystack</option>
            </select>
          </div>
          <DialogFooter>
            <Button
              onClick={() => withdraw.mutate()}
              disabled={withdraw.isPending || Number(amount) < MIN_PAYOUT || Number(amount) > aff.available}
              className="bg-green-600 hover:bg-green-500"
            >
              {withdraw.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Request {amount ? formatMoney(Number(amount)) : "withdrawal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
