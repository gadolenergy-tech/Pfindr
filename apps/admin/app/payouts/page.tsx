"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { AdminVendorBalance } from "@finder/shared";
import { AdminShell } from "@/components/admin-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { vendorPayoutApi } from "@/lib/queries";

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);

export default function PayoutsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [target, setTarget] = useState<AdminVendorBalance | null>(null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin", "vendor-payouts"],
    queryFn: vendorPayoutApi.balances,
  });

  const history = useQuery({
    queryKey: ["admin", "vendor-payouts", target?.vendorId],
    queryFn: () => vendorPayoutApi.history(target!.vendorId),
    enabled: Boolean(target),
  });

  function open(row: AdminVendorBalance) {
    setTarget(row);
    setAmount(row.owed > 0 ? row.owed.toFixed(2) : "");
    setReference("");
    setNote("");
  }

  const record = useMutation({
    mutationFn: () =>
      vendorPayoutApi.record(target!.vendorId, {
        currency: target!.currency,
        amount: Number(amount),
        reference: reference || null,
        note: note || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast({ title: "Payout recorded", description: `${target!.businessName} · ${money(Number(amount), target!.currency)}` });
      setTarget(null);
    },
    onError: (err: Error) => toast({ title: "Could not record payout", description: err.message, variant: "destructive" }),
  });

  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0 && target !== null && value <= target.owed + 1e-9;

  return (
    <AdminShell title="Payouts" description="What Finder owes vendors from Buy now orders">
      <Alert className="border-white/[0.08]">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Buy now payments land in Finder&apos;s Paystack account. Send the money to the vendor by bank transfer, then
          record it here so the balance stays honest. A payout can never exceed what is owed, and every one is written
          to the audit log.
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : rows && rows.length > 0 ? (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={`${r.vendorId}-${r.currency}`} className="bg-card border-white/[0.06]">
              <CardContent className="pt-6 flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-200 truncate">{r.businessName}</h3>
                  <p className="text-xs text-slate-500">{r.contactEmail}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    ["Earned", money(r.earned, r.currency)],
                    ["Paid out", money(r.paidOut, r.currency)],
                    ["Owed", money(r.owed, r.currency)],
                  ].map(([label, v]) => (
                    <div key={label} className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-slate-600">{label}</div>
                      <div className={`text-sm font-semibold tabular-nums ${label === "Owed" && r.owed < 0 ? "text-rose-400" : "text-slate-200"}`}>{v}</div>
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="outline" className="border-white/[0.08]" onClick={() => open(r)}>
                  <Banknote className="h-4 w-4 mr-1.5" /> {r.owed > 0 ? "Record payout" : "View"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-card border-white/[0.06]">
          <CardContent className="py-16 text-center">
            <Banknote className="h-8 w-8 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No paid Buy now orders yet.</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{target?.businessName}</DialogTitle>
            <DialogDescription>
              {target && `Owed ${money(target.owed, target.currency)}. Record only money you have already sent.`}
            </DialogDescription>
          </DialogHeader>

          {target && target.owed > 0 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="payout-amount">Amount sent ({target.currency})</Label>
                <Input id="payout-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                {Number.isFinite(value) && value > target.owed + 1e-9 && (
                  <p className="text-xs text-rose-400">That is more than the {money(target.owed, target.currency)} owed.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payout-ref">Transfer reference</Label>
                <Input id="payout-ref" value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} placeholder="From your bank statement" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payout-note">Note (optional)</Label>
                <Input id="payout-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
          )}

          {history.data && history.data.payouts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-600">Previous payouts</p>
              {history.data.payouts.slice(0, 5).map((p) => (
                <div key={p.id} className="flex justify-between text-xs text-slate-400">
                  <span>{money(p.amount, p.currency)}{p.reference ? ` · ${p.reference}` : ""}</span>
                  <span>{formatDistanceToNow(new Date(p.paidAt), { addSuffix: true })}</span>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)}>Close</Button>
            {target && target.owed > 0 && (
              <Button disabled={!valid || record.isPending} onClick={() => record.mutate()}>
                {record.isPending ? "Recording…" : "Record payout"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
