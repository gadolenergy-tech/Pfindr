"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  customersApi,
  formatMoney,
  inventoryApi,
  ordersApi,
} from "@/lib/vendor-api";

const INPUT =
  "w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/40 transition-all";
const LABEL =
  "block text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1.5 font-semibold";

type Line = { inventoryItemId: string; quantity: string; unitPrice: string };

const NEW_CUSTOMER = "__new__";

/**
 * Records an order against the vendor's own stock — typically a quote agreed
 * in messages. Stock is decremented server-side in the same transaction.
 */
export function RecordOrderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [customerId, setCustomerId] = useState<string>(NEW_CUSTOMER);
  const [customer, setCustomer] = useState({ fullName: "", email: "", phone: "", company: "" });
  const [lines, setLines] = useState<Line[]>([{ inventoryItemId: "", quantity: "1", unitPrice: "" }]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: customers } = useQuery({
    queryKey: ["customers", "all"],
    queryFn: () => customersApi.list("?limit=100"),
    enabled: open,
  });

  const { data: stock } = useQuery({
    queryKey: ["inventory", "orderable"],
    queryFn: () => inventoryApi.list("?limit=100&sort=name&order=asc"),
    enabled: open,
  });

  const orderable = (stock ?? []).filter(
    (i) => i.status !== "DISCONTINUED" && i.quantity > 0,
  );
  const byId = useMemo(() => new Map((stock ?? []).map((i) => [i.id, i])), [stock]);

  const total = lines.reduce((sum, line) => {
    const item = byId.get(line.inventoryItemId);
    const price = line.unitPrice !== "" ? Number(line.unitPrice) : item?.price ?? 0;
    return sum + price * (Number(line.quantity) || 0);
  }, 0);

  function reset() {
    setCustomerId(NEW_CUSTOMER);
    setCustomer({ fullName: "", email: "", phone: "", company: "" });
    setLines([{ inventoryItemId: "", quantity: "1", unitPrice: "" }]);
    setNote("");
    setError(null);
  }

  const create = useMutation({
    mutationFn: ordersApi.create,
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast({ title: "Order recorded", description: `${order.orderNumber} · stock updated` });
      reset();
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  function submit() {
    setError(null);
    const items = lines
      .filter((l) => l.inventoryItemId)
      .map((l) => ({
        inventoryItemId: l.inventoryItemId,
        quantity: Number(l.quantity),
        ...(l.unitPrice !== "" ? { unitPrice: Number(l.unitPrice) } : {}),
      }));

    if (items.length === 0) return setError("Add at least one product.");
    if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1)) {
      return setError("Quantities must be whole numbers of 1 or more.");
    }
    if (customerId === NEW_CUSTOMER && customer.fullName.trim().length < 2) {
      return setError("Enter the customer's name.");
    }

    create.mutate({
      ...(customerId === NEW_CUSTOMER
        ? {
            customer: {
              fullName: customer.fullName.trim(),
              email: customer.email.trim() || null,
              phone: customer.phone.trim() || null,
              company: customer.company.trim() || null,
            },
          }
        : { customerId }),
      items,
      note: note.trim() || null,
    });
  }

  const updateLine = (index: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl bg-[#060d1f] border-white/[0.08] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Record an order</DialogTitle>
          <DialogDescription>
            Log a sale agreed with a buyer. The quantities come off your live stock immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <label className={LABEL}>Customer</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className={`${INPUT} text-slate-300`}
            >
              <option value={NEW_CUSTOMER}>+ New customer</option>
              {(customers ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                  {c.company ? ` — ${c.company}` : ""}
                </option>
              ))}
            </select>
          </div>

          {customerId === NEW_CUSTOMER && (
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["fullName", "Name", "Lagos General Hospital"],
                  ["company", "Company", "Optional"],
                  ["email", "Email", "Optional"],
                  ["phone", "Phone", "Optional"],
                ] as const
              ).map(([key, label, placeholder]) => (
                <div key={key}>
                  <label className={LABEL}>{label}</label>
                  <input
                    value={customer[key]}
                    onChange={(e) => setCustomer((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className={INPUT}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <label className={LABEL}>Products</label>
            {lines.map((line, index) => {
              const item = byId.get(line.inventoryItemId);
              return (
                <div key={index} className="flex gap-2 items-start">
                  <select
                    value={line.inventoryItemId}
                    onChange={(e) => updateLine(index, { inventoryItemId: e.target.value, unitPrice: "" })}
                    className={`${INPUT} text-slate-300 flex-[3]`}
                  >
                    <option value="">Select product…</option>
                    {orderable.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.quantity} {i.unit})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={item?.quantity}
                    value={line.quantity}
                    onChange={(e) => updateLine(index, { quantity: e.target.value })}
                    className={`${INPUT} flex-1`}
                    aria-label="Quantity"
                  />
                  <input
                    type="number"
                    min={0}
                    value={line.unitPrice}
                    onChange={(e) => updateLine(index, { unitPrice: e.target.value })}
                    placeholder={item ? String(item.price) : "Price"}
                    className={`${INPUT} flex-1`}
                    aria-label="Unit price"
                    title="Agreed unit price — leave blank to use your listed price"
                  />
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                    disabled={lines.length === 1}
                    className="p-2 text-slate-600 hover:text-red-400 disabled:opacity-30"
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setLines((prev) => [...prev, { inventoryItemId: "", quantity: "1", unitPrice: "" }])}
              className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Add another product
            </button>
            {stock && orderable.length === 0 && (
              <p className="text-[12px] text-amber-400">
                You have nothing in stock to sell. Add inventory first.
              </p>
            )}
          </div>

          <div>
            <label className={LABEL}>Note</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Delivery terms, reference number… (optional)"
              className={`${INPUT} resize-none`}
            />
          </div>

          {error && <p className="text-[12px] text-red-400">{error}</p>}
        </div>

        <DialogFooter className="items-center sm:justify-between gap-3">
          <div className="text-sm text-slate-400">
            Total <span className="text-white font-bold tabular-nums">{formatMoney(total)}</span>
          </div>
          <Button onClick={submit} disabled={create.isPending} className="bg-blue-600 hover:bg-blue-500">
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
