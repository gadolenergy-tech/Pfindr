"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, Package, Search, Trash2 } from "lucide-react";
import { createInventoryItemSchema } from "@finder/shared";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/api";
import {
  formatMoney,
  inventoryApi,
  STATUS_LABEL,
  type InventoryItem,
} from "@/lib/vendor-api";

const INPUT =
  "w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all";
const SELECT =
  "w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-slate-300 outline-none focus:border-blue-500/40 transition-all appearance-none";
const LABEL =
  "block text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1.5 font-semibold";

const UNITS = ["unit", "kg", "litre", "carton", "pallet", "box", "pack"];

const EMPTY = {
  name: "",
  sku: "",
  categoryId: "",
  quantity: "",
  unit: "unit",
  price: "",
  discontinued: false,
  notes: "",
};

/** Row in the product list, expandable to adjust stock inline. */
function ProductRow({ item }: { item: InventoryItem }) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [price, setPrice] = useState(String(item.price));
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["inventory"] });

  const save = useMutation({
    mutationFn: () =>
      inventoryApi.update(item.id, {
        quantity: Number(quantity),
        price: Number(price),
      }),
    onSuccess: () => {
      void refresh();
      toast({ title: "Stock updated", description: item.name });
    },
    onError: (err: Error) =>
      toast({ title: "Could not update", description: err.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: () => inventoryApi.remove(item.id),
    onSuccess: () => {
      void refresh();
      toast({ title: "Removed from Finder", description: item.name });
    },
    onError: (err: Error) =>
      toast({ title: "Could not remove", description: err.message, variant: "destructive" }),
  });

  const isLow = item.status === "LOW_STOCK";
  const isCrit = item.status === "OUT_OF_STOCK";
  const isOff = item.status === "DISCONTINUED";

  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl hover:bg-white/[0.04] transition-all">
      <div className="flex items-center gap-3 p-3.5">
        <div
          className={`w-1.5 h-10 rounded-full shrink-0 ${
            isCrit ? "bg-red-500/80" : isLow ? "bg-amber-500/80" : isOff ? "bg-slate-600" : "bg-green-500/50"
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-slate-200 truncate">{item.name}</div>
          <div className="text-[10px] text-slate-500">
            {item.sku ?? "No SKU"} · {item.category?.name ?? "Uncategorised"} · {STATUS_LABEL[item.status]}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div
            className={`text-[12px] font-bold tabular-nums ${
              isCrit ? "text-red-400" : isLow ? "text-amber-400" : "text-slate-300"
            }`}
          >
            {item.quantity.toLocaleString()} {item.unit}
          </div>
          <div className="text-[10px] text-slate-500">{formatMoney(item.price, item.currency)}</div>
        </div>
        <button
          type="button"
          aria-label={open ? "Collapse" : "Adjust stock"}
          onClick={() => setOpen(!open)}
          className="text-slate-600 hover:text-slate-400 transition-colors ml-1"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="px-3.5 pb-3.5 flex items-end gap-2 border-t border-white/[0.04] pt-3">
          <div className="flex-1">
            <label className={LABEL}>Quantity</label>
            <input type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={INPUT} />
          </div>
          <div className="flex-1">
            <label className={LABEL}>Price (₦)</label>
            <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className={INPUT} />
          </div>
          <Button
            size="sm"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="bg-blue-600 hover:bg-blue-500 h-[42px]"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm(`Remove "${item.name}" from Finder?`)) remove.mutate();
            }}
            className="text-red-400 hover:text-red-300 h-[42px]"
            aria-label="Remove product"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function ManualEntry() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: inventoryApi.categories,
  });

  const params = new URLSearchParams({ limit: showAll ? "100" : "8" });
  if (search.trim()) params.set("q", search.trim());

  const { data: items, isLoading } = useQuery({
    queryKey: ["inventory", "list", search, showAll],
    queryFn: () => inventoryApi.list(`?${params.toString()}`),
  });

  const { data: summary } = useQuery({
    queryKey: ["inventory", "summary"],
    queryFn: inventoryApi.summary,
  });

  const create = useMutation({
    mutationFn: inventoryApi.create,
    onSuccess: (item) => {
      setForm(EMPTY);
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast({
        title: "Live on Finder",
        description: `${item.name} — ${STATUS_LABEL[item.status].toLowerCase()}`,
      });
    },
    onError: (err: Error) => {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      toast({ title: "Could not add product", description: err.message, variant: "destructive" });
    },
  });

  const set = (key: keyof typeof EMPTY) => (value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const parsed = createInventoryItemSchema.safeParse({
      name: form.name,
      sku: form.sku || null,
      categoryId: form.categoryId || null,
      quantity: form.quantity,
      unit: form.unit,
      price: form.price.replace(/[₦,\s]/g, ""),
      status: form.discontinued ? "DISCONTINUED" : undefined,
      notes: form.notes || null,
    });

    if (!parsed.success) {
      const issues: Record<string, string> = {};
      for (const issue of parsed.error.issues) issues[issue.path.join(".")] = issue.message;
      setErrors(issues);
      return;
    }
    // Drop schema-filled defaults so the server applies the vendor's own
    // threshold and currency from Settings → Preferences.
    const { lowStockThreshold: _threshold, currency: _currency, ...payload } = parsed.data;
    create.mutate(payload);
  }

  const err = (field: string) =>
    errors[field] ? <p className="text-[11px] text-red-400 mt-1">{errors[field]}</p> : null;

  return (
    <div className="space-y-8">
      <div className="grid md:grid-cols-2 gap-6">
        <form onSubmit={submit} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white mb-4">Add New Product</h3>
          <div>
            <label className={LABEL}>Product Name</label>
            <input value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. Amoxicillin 500mg" className={INPUT} />
            {err("name")}
          </div>
          <div>
            <label className={LABEL}>SKU / Product Code</label>
            <input value={form.sku} onChange={(e) => set("sku")(e.target.value)} placeholder="e.g. MED-001" className={INPUT} />
            {err("sku")}
          </div>
          <div>
            <label className={LABEL}>Category</label>
            <select value={form.categoryId} onChange={(e) => set("categoryId")(e.target.value)} className={SELECT}>
              <option value="">Select a category</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Quantity</label>
              <input type="number" min={0} value={form.quantity} onChange={(e) => set("quantity")(e.target.value)} placeholder="500" className={INPUT} />
              {err("quantity")}
            </div>
            <div>
              <label className={LABEL}>Unit Type</label>
              <select value={form.unit} onChange={(e) => set("unit")(e.target.value)} className={SELECT}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Price (₦)</label>
              <input inputMode="decimal" value={form.price} onChange={(e) => set("price")(e.target.value)} placeholder="1,200" className={INPUT} />
              {err("price")}
            </div>
            <div>
              <label className={LABEL}>Availability</label>
              {/* Stock status is derived from quantity on the server; only
                  "discontinued" is a manual choice. */}
              <select
                value={form.discontinued ? "off" : "auto"}
                onChange={(e) => set("discontinued")(e.target.value === "off")}
                className={SELECT}
              >
                <option value="auto">From quantity</option>
                <option value="off">Discontinued</option>
              </select>
            </div>
          </div>
          <div>
            <label className={LABEL}>Vendor Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => set("notes")(e.target.value)} placeholder="Any notes for buyers (optional)…"
              className={`${INPUT} resize-none`} />
          </div>
          <Button type="submit" disabled={create.isPending} className="w-full bg-blue-600 hover:bg-blue-500 text-white gap-2 mt-2">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
            Add Product to Finder
          </Button>
        </form>

        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-white">Your Products</h3>
            <span className="text-[11px] text-slate-500">{summary?.totalItems ?? 0} items</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-600" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or SKU" className={`${INPUT} pl-9 py-2`} />
          </div>

          {isLoading ? (
            [0, 1, 2, 3].map((i) => <div key={i} className="h-[68px] bg-white/[0.02] border border-white/[0.05] rounded-xl animate-pulse" />)
          ) : items && items.length > 0 ? (
            items.map((item) => <ProductRow key={item.id} item={item} />)
          ) : (
            <div className="text-center py-10 border border-dashed border-white/[0.06] rounded-xl">
              <Package className="h-6 w-6 text-slate-700 mx-auto mb-2" />
              <p className="text-[12px] text-slate-500">
                {search ? "No products match that search." : "No products yet — add your first one."}
              </p>
            </div>
          )}

          {!showAll && (summary?.totalItems ?? 0) > (items?.length ?? 0) && (
            <button type="button" onClick={() => setShowAll(true)} className="w-full text-center text-[11px] text-slate-600 hover:text-slate-400 transition-colors py-2">
              + View all {summary?.totalItems} products
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
