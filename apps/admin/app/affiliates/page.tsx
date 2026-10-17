"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Info, PauseCircle, PlayCircle, PlusCircle, Share2, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { affiliateAdminApi, type AdminAffiliate } from "@/lib/queries";

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

export default function AffiliatesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: affiliates, isLoading } = useQuery({
    queryKey: ["admin", "affiliates"],
    queryFn: affiliateAdminApi.list,
  });

  const onDone = (title: string) => () => {
    void queryClient.invalidateQueries({ queryKey: ["admin"] });
    toast({ title });
  };
  const onFail = (err: Error) => toast({ title: "Action failed", description: err.message, variant: "destructive" });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "SUSPENDED" }) => affiliateAdminApi.setStatus(id, status),
    onSuccess: onDone("Affiliate updated"),
    onError: onFail,
  });

  const credit = useMutation({
    mutationFn: ({ id, amount, note }: { id: string; amount: number; note?: string }) =>
      affiliateAdminApi.credit(id, amount, note),
    onSuccess: onDone("Commission credited"),
    onError: onFail,
  });

  const settle = useMutation({
    mutationFn: ({ id, status, reference }: { id: string; status: "PAID" | "FAILED"; reference?: string }) =>
      affiliateAdminApi.settlePayout(id, status, reference),
    onSuccess: onDone("Payout settled"),
    onError: onFail,
  });

  function promptCredit(a: AdminAffiliate) {
    const raw = window.prompt(`Credit commission to ${a.name} (₦):`);
    if (!raw) return;
    const amount = Number(raw.replace(/[₦,\s]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Enter a positive amount", variant: "destructive" });
      return;
    }
    const note = window.prompt("Note for the audit log (optional):") ?? undefined;
    credit.mutate({ id: a.id, amount, note: note || undefined });
  }

  return (
    <AdminShell title="Affiliates" description="Referral partners, commission and payouts">
      <Alert className="border-white/[0.08]">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Finder has no subscription billing yet, so commission is credited by hand here. Each affiliate&apos;s tier
          rate is recorded for when billing arrives. Every credit and payout is written to the audit log.
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : affiliates && affiliates.length > 0 ? (
        <div className="space-y-3">
          {affiliates.map((a) => (
            <Card key={a.id} className="bg-card border-white/[0.06]">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-200">{a.name}</h3>
                      <Badge variant="outline" className={a.status === "ACTIVE"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"}>
                        {a.status.toLowerCase()}
                      </Badge>
                      <span className="font-mono text-[11px] text-slate-500">{a.code}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {a.email} · pays to {a.payoutEmail} · joined {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="border-white/[0.08]" onClick={() => promptCredit(a)}>
                      <PlusCircle className="h-4 w-4 mr-1.5" /> Credit
                    </Button>
                    {a.status === "ACTIVE" ? (
                      <Button size="sm" variant="ghost" className="text-slate-400"
                        onClick={() => setStatus.mutate({ id: a.id, status: "SUSPENDED" })}>
                        <PauseCircle className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="text-emerald-400"
                        onClick={() => setStatus.mutate({ id: a.id, status: "ACTIVE" })}>
                        <PlayCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
                  {[
                    ["Clicks", a.clicks.toLocaleString()],
                    ["Signups", String(a.referrals)],
                    ["Active", String(a.converted)],
                    ["Rate", `${Math.round(a.commissionRate * 100)}%`],
                    ["Balance", naira.format(a.balance)],
                    ["Earned", naira.format(a.totalEarned)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-white/[0.02] border border-white/[0.04] py-2">
                      <div className="text-[10px] uppercase tracking-wide text-slate-600">{label}</div>
                      <div className="text-sm font-semibold text-slate-200 tabular-nums">{value}</div>
                    </div>
                  ))}
                </div>

                {a.pendingPayouts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-2.5 text-sm">
                    <span className="text-amber-200">
                      Payout request · {naira.format(p.amount)} via {p.method === "PAYSTACK" ? "Paystack" : "bank transfer"} ·{" "}
                      {formatDistanceToNow(new Date(p.requestedAt), { addSuffix: true })}
                    </span>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="ghost" className="text-emerald-400"
                        onClick={() => {
                          const reference = window.prompt("Transfer reference (optional):") ?? undefined;
                          settle.mutate({ id: p.id, status: "PAID", reference: reference || undefined });
                        }}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Paid
                      </Button>
                      <Button size="sm" variant="ghost" className="text-rose-400"
                        onClick={() => settle.mutate({ id: p.id, status: "FAILED" })}>
                        <XCircle className="h-4 w-4 mr-1" /> Failed
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-card border-white/[0.06]">
          <CardContent className="py-16 text-center">
            <Share2 className="h-8 w-8 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No affiliates yet.</p>
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
}
