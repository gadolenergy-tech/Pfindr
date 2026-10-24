"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ChevronDown, ImagePlus, Loader2, Package, Search, Sparkles, Trash2, X } from "lucide-react";
import { IMAGE_LIBRARY_BATCH } from "@finder/shared";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ImageUploadButton } from "@/components/image-upload";
import { UPLOAD_ACCEPT, uploadImage } from "@/lib/upload";
import {
  formatMoney,
  inventoryApi,
  STATUS_LABEL,
  type ImageMatchResult,
  type InventoryItem,
} from "@/lib/vendor-api";

const INPUT =
  "w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all";
const LABEL = "block text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1.5 font-semibold";
const PHOTO_BUTTON =
  "text-[11px] text-slate-300 border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60";

/** Photos uploaded to the bucket at once; the rest wait their turn. */
const UPLOAD_CONCURRENCY = 3;

/** "3 photos matched to products" style summary of a library upload or match click. */
export function describeMatch(result: ImageMatchResult): string {
  const matched = `${result.matched} product${result.matched === 1 ? "" : "s"} got a photo`;
  if (result.unmatched.length === 0) return matched;
  return `${matched}. ${result.unmatched.length} photo${result.unmatched.length === 1 ? "" : "s"} matched no product yet and ${result.unmatched.length === 1 ? "is" : "are"} saved for later`;
}

/**
 * One product in the list. Collapsed it shows the photo (or an Add photo
 * button); expanded it edits stock, price, brand, description and the photo.
 */
function ProductRow({ item }: { item: InventoryItem }) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [price, setPrice] = useState(String(item.price));
  const [brand, setBrand] = useState(item.brand ?? "");
  const [description, setDescription] = useState(item.description ?? "");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["inventory"] });
  const fail = (title: string) => (err: Error) => toast({ title, description: err.message, variant: "destructive" });

  const save = useMutation({
    mutationFn: () =>
      inventoryApi.update(item.id, {
        quantity: Number(quantity),
        price: Number(price),
        brand: brand.trim() || null,
        description: description.trim() || null,
      }),
    onSuccess: () => {
      void refresh();
      toast({ title: "Product updated", description: item.name });
    },
    onError: fail("Could not update"),
  });

  const setPhoto = useMutation({
    mutationFn: (imageUrl: string | null) => inventoryApi.update(item.id, { imageUrl }),
    onSuccess: (_saved, imageUrl) => {
      void refresh();
      toast({ title: imageUrl ? "Photo saved" : "Photo removed", description: item.name });
    },
    onError: fail("Could not update the photo"),
  });

  const remove = useMutation({
    mutationFn: () => inventoryApi.remove(item.id),
    onSuccess: () => {
      void refresh();
      toast({ title: "Removed from Finder", description: item.name });
    },
    onError: fail("Could not remove"),
  });

  const isLow = item.status === "LOW_STOCK";
  const isCrit = item.status === "OUT_OF_STOCK";
  const isOff = item.status === "DISCONTINUED";
  const uploadFailed = (message: string) =>
    toast({ title: "Upload failed", description: message, variant: "destructive" });

  return (
    <div data-testid={`product-row-${item.id}`} className="bg-white/[0.02] border border-white/[0.05] rounded-xl hover:bg-white/[0.04] transition-all">
      <div className="flex items-center gap-3 p-3.5">
        <div
          className={`w-1.5 h-10 rounded-full shrink-0 ${
            isCrit ? "bg-red-500/80" : isLow ? "bg-amber-500/80" : isOff ? "bg-slate-600" : "bg-green-500/50"
          }`}
        />
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- bucket host is configured per environment
          <img src={item.imageUrl} alt={`${item.name} photo`} className="w-11 h-11 rounded-lg object-cover border border-white/[0.06] shrink-0" />
        ) : (
          <ImageUploadButton
            purpose="product"
            onUploaded={async (url) => { await setPhoto.mutateAsync(url); }}
            onError={uploadFailed}
            className="w-11 h-11 rounded-lg border border-dashed border-white/[0.15] text-slate-500 hover:text-blue-300 hover:border-blue-500/40 flex items-center justify-center shrink-0 transition-colors"
          >
            <Camera className="h-4 w-4" aria-label={`Add photo for ${item.name}`} />
          </ImageUploadButton>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-slate-200 truncate">
            {item.name}
            {item.brand && <span className="text-slate-500 font-normal"> · {item.brand}</span>}
          </div>
          <div className="text-[10px] text-slate-500">
            {item.sku ?? "No SKU"} · {item.category?.name ?? "Uncategorised"} · {STATUS_LABEL[item.status]}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-[12px] font-bold tabular-nums ${isCrit ? "text-red-400" : isLow ? "text-amber-400" : "text-slate-300"}`}>
            {item.quantity.toLocaleString()} {item.unit}
          </div>
          <div className="text-[10px] text-slate-500">{formatMoney(item.price, item.currency)}</div>
        </div>
        <button
          type="button"
          aria-label={open ? "Collapse" : "Edit product"}
          onClick={() => setOpen(!open)}
          className="text-slate-600 hover:text-slate-400 transition-colors ml-1"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-3 border-t border-white/[0.04] pt-3">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl bg-white/[0.03] border border-white/[0.07] overflow-hidden flex items-center justify-center shrink-0">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- bucket host is configured per environment
                <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Package className="h-5 w-5 text-slate-700" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ImageUploadButton
                purpose="product"
                onUploaded={async (url) => { await setPhoto.mutateAsync(url); }}
                onError={uploadFailed}
                className={PHOTO_BUTTON}
              >
                {item.imageUrl ? "Replace photo" : "Add photo"}
              </ImageUploadButton>
              {item.imageUrl && (
                <button
                  type="button"
                  disabled={setPhoto.isPending}
                  onClick={() => setPhoto.mutate(null)}
                  className="text-[11px] text-slate-500 hover:text-red-400 px-2 py-1 transition-colors"
                >
                  Remove photo
                </button>
              )}
              <p className="basis-full text-[10px] text-slate-600">
                Buyers see this photo, the brand and the description on the product page before they pay.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={LABEL}>Quantity</label>
              <input type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Price (₦)</label>
              <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className={INPUT} />
            </div>
          </div>
          <div>
            <label className={LABEL}>Brand / Manufacturer</label>
            <input value={brand} maxLength={120} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Emzor, Dangote" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Description</label>
            <textarea rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Strength, pack size, specification…" className={`${INPUT} resize-none`} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(`Remove "${item.name}" from Finder?`)) remove.mutate();
              }}
              className="text-red-400 hover:text-red-300"
              aria-label="Remove product"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()} className="bg-blue-600 hover:bg-blue-500 px-6">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Bulk photos. The vendor picks many files named after their SKUs or product
 * names; each is uploaded, remembered in the photo library, and matched to the
 * product it names. The same library is used on every later CSV import.
 */
function PhotoToolbar({ totalItems, withPhotos }: { totalItems: number; withPhotos: number }) {
  const picker = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [leftover, setLeftover] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["inventory"] });

  const match = useMutation({
    mutationFn: inventoryApi.matchImages,
    onSuccess: (result) => {
      void refresh();
      setLeftover(result.unmatched);
      toast({ title: result.matched ? "Photos matched" : "Nothing new to match", description: describeMatch(result) });
    },
    onError: (err: Error) => toast({ title: "Could not match photos", description: err.message, variant: "destructive" }),
  });

  async function uploadAll(files: File[]) {
    setLeftover([]);
    setProgress({ done: 0, total: files.length });
    const uploaded: { url: string; fileName: string }[] = [];
    const failed: string[] = [];
    let next = 0;
    let done = 0;

    // A few uploads at a time, so a folder of 50 photos neither crawls nor floods the connection.
    async function worker() {
      while (next < files.length) {
        const file = files[next++]!;
        try {
          uploaded.push({ url: await uploadImage(file, "product"), fileName: file.name });
        } catch {
          failed.push(file.name);
        }
        setProgress({ done: ++done, total: files.length });
      }
    }
    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, worker));

    try {
      const unmatched: string[] = [];
      let matched = 0;
      for (let i = 0; i < uploaded.length; i += IMAGE_LIBRARY_BATCH) {
        const result = await inventoryApi.registerImages(uploaded.slice(i, i + IMAGE_LIBRARY_BATCH));
        matched += result.matched;
        // Each batch reports every unmatched photo in the library; the last answer is the full picture.
        unmatched.splice(0, unmatched.length, ...result.unmatched);
      }
      setLeftover(unmatched);
      toast({
        title: `${uploaded.length} photo${uploaded.length === 1 ? "" : "s"} uploaded`,
        description: [describeMatch({ matched, unmatched }), failed.length ? `${failed.length} failed: ${failed.slice(0, 3).join(", ")}` : ""]
          .filter(Boolean)
          .join(". "),
        variant: failed.length && uploaded.length === 0 ? "destructive" : undefined,
      });
    } catch (err) {
      toast({ title: "Could not save the photos", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setProgress(null);
      void refresh();
    }
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length) void uploadAll(files);
  }

  const missing = totalItems - withPhotos;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] font-semibold text-slate-200">Product photos</div>
          <div data-testid="photo-coverage" className="text-[10px] text-slate-500">
            {totalItems === 0 ? "Add products first." : `${withPhotos} of ${totalItems} products have a photo`}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <input ref={picker} type="file" multiple accept={UPLOAD_ACCEPT} className="hidden" onChange={onPick} />
          <button type="button" data-testid="photos-upload" disabled={!!progress} onClick={() => picker.current?.click()} className={`${PHOTO_BUTTON} flex items-center gap-1.5`}>
            {progress ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
            {progress ? `Uploading ${progress.done}/${progress.total}` : "Upload photos"}
          </button>
          <button type="button" data-testid="photos-match" disabled={match.isPending || !!progress || missing === 0} onClick={() => match.mutate()}
            className="text-[11px] text-blue-200 border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5">
            {match.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Match photos
          </button>
        </div>
      </div>
      <p className="text-[10px] text-slate-600 leading-relaxed">
        Name each photo after its product code or product name (e.g. <span className="font-mono text-slate-500">MED-001.jpg</span>,{" "}
        <span className="font-mono text-slate-500">Amoxicillin 500mg.png</span>) and Finder attaches it automatically. Photos are remembered,
        so the next CSV import picks them up again.
      </p>
      {leftover.length > 0 && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200">
          <span>
            No product matched: <span className="font-mono">{leftover.slice(0, 5).join(", ")}</span>
            {leftover.length > 5 && ` and ${leftover.length - 5} more`}. Rename them to a product code or name, or add them to a product by hand.
          </span>
          <button type="button" aria-label="Dismiss" onClick={() => setLeftover([])} className="text-amber-300/70 hover:text-amber-200 shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/** The vendor's product list: search, photos, and per-product editing. */
export function ProductList() {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-white">Your Products</h3>
        <span className="text-[11px] text-slate-500">{summary?.totalItems ?? 0} items</span>
      </div>

      <PhotoToolbar totalItems={summary?.totalItems ?? 0} withPhotos={summary?.withImages ?? 0} />

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
  );
}
