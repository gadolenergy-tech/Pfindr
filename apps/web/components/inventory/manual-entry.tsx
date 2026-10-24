"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Package } from "lucide-react";
import { createInventoryItemSchema } from "@finder/shared";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ImageUploadButton } from "@/components/image-upload";
import { ProductList } from "@/components/inventory/product-list";
import { ApiError } from "@/lib/api";
import { inventoryApi, STATUS_LABEL } from "@/lib/vendor-api";

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
  brand: "",
  description: "",
  categoryId: "",
  quantity: "",
  unit: "unit",
  price: "",
  discontinued: false,
  notes: "",
  imageUrl: "",
};

export function ManualEntry() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: inventoryApi.categories,
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
      brand: form.brand || null,
      description: form.description || null,
      categoryId: form.categoryId || null,
      quantity: form.quantity,
      unit: form.unit,
      price: form.price.replace(/[₦,\s]/g, ""),
      status: form.discontinued ? "DISCONTINUED" : undefined,
      notes: form.notes || null,
      imageUrl: form.imageUrl || null,
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
            <label className={LABEL}>Brand / Manufacturer</label>
            <input value={form.brand} maxLength={120} onChange={(e) => set("brand")(e.target.value)} placeholder="e.g. Emzor, Dangote" className={INPUT} />
            <p className="text-[10px] text-slate-600 mt-1">Buyers use this to tell similar products from different makers apart.</p>
            {err("brand")}
          </div>
          <div>
            <label className={LABEL}>Product Description</label>
            <textarea rows={3} maxLength={2000} value={form.description} onChange={(e) => set("description")(e.target.value)}
              placeholder="Strength, pack size, specification…" className={`${INPUT} resize-none`} />
            {err("description")}
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
          <div>
            <label className={LABEL}>Product Photo</label>
            <div className="flex items-center gap-3">
              {form.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- bucket host is configured per environment
                <img src={form.imageUrl} alt="Product preview" className="w-14 h-14 rounded-lg object-cover border border-white/[0.08]" />
              )}
              <ImageUploadButton
                purpose="product"
                onUploaded={(url) => set("imageUrl")(url)}
                onError={(message) => toast({ title: "Upload failed", description: message, variant: "destructive" })}
                className="text-[11px] text-slate-300 border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {form.imageUrl ? "Change photo" : "Upload photo (optional)"}
              </ImageUploadButton>
              {form.imageUrl && (
                <button type="button" onClick={() => set("imageUrl")("")} className="text-[11px] text-slate-500 hover:text-red-400 transition-colors">
                  Remove
                </button>
              )}
            </div>
            {err("imageUrl")}
          </div>
          <Button type="submit" disabled={create.isPending} className="w-full bg-blue-600 hover:bg-blue-500 text-white gap-2 mt-2">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
            Add Product to Finder
          </Button>
        </form>

        <ProductList />
      </div>
    </div>
  );
}
