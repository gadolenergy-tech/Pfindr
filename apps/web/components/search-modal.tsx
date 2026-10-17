"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, MapPin, Package, ScanSearch, Camera, ImageUp, CheckCircle2, Loader2, Phone, AlertTriangle, Clock, Navigation, TrendingUp, ChevronDown, LocateFixed, MessageSquare, ShoppingCart } from "lucide-react";
import { CheckoutDialog, type CheckoutItem } from "@/components/checkout-dialog";
import type { DiscoverResult } from "@finder/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { formatMoney, timeAgo } from "@/lib/vendor-api";
import { CITY_CENTRES, formatDistance, readSavedCity, saveCity, type SearchOrigin } from "@/lib/locations";

/** Tab label → category slug in the database (see apps/api/prisma/seed.ts). */
const CATEGORIES = [
  { label: "All", slug: null },
  { label: "Healthcare", slug: "healthcare" },
  { label: "Food & Bev", slug: "food-beverage" },
  { label: "Industrial", slug: "industrial" },
  { label: "Oil & Gas", slug: "oil-gas" },
  { label: "Emergency", slug: "emergency" },
  { label: "Everyday", slug: "everyday" },
] as const;
type Category = (typeof CATEGORIES)[number]["label"];

type StockLevel = "high" | "medium" | "low";

type ResultRow = {
  id: string;
  product: string;
  vendor: string;
  vendorId: string;
  vendorCity: string;
  category: string;
  /** Formatted distance ("3.8 km"), or null when the vendor has no pinned location. */
  distance: string | null;
  location: string;
  stock: number;
  stockStatus: StockLevel;
  price: string;
  unit: string;
  verified: boolean;
  syncAge: string;
  live: boolean;
  /** Vendor hides exact stock; show availability only. */
  qtyHidden: boolean;
  /** Street, city and state, for the expanded card. */
  address: string;
  /** What Buy now checks out; null when there is no price to charge. */
  buy: CheckoutItem | null;
};

const PLACEHOLDERS = [
  "Search amoxicillin 500mg...",
  "Search blood type O+...",
  "Search hydraulic pump...",
  "Search gas cylinder 12.5kg...",
  "Search palm oil 25L...",
  "Search fire extinguisher...",
  "Search A4 paper ream...",
  "Search welding rod...",
];

const STOCK_CONFIG = {
  high: {
    dot: "bg-green-400",
    text: "text-green-400",
    bar: "bg-gradient-to-r from-green-600 to-green-400",
    glow: "shadow-[0_0_6px_rgba(74,222,128,0.4)]",
    label: "In Stock",
  },
  medium: {
    dot: "bg-amber-400",
    text: "text-amber-400",
    bar: "bg-gradient-to-r from-amber-600 to-amber-400",
    glow: "shadow-[0_0_6px_rgba(251,191,36,0.4)]",
    label: "Limited",
  },
  low: {
    dot: "bg-red-400",
    text: "text-red-400",
    bar: "bg-gradient-to-r from-red-600 to-red-400",
    glow: "shadow-[0_0_6px_rgba(248,113,113,0.4)]",
    label: "Low Stock",
  },
};

function toRow(r: DiscoverResult): ResultRow {
  const stockStatus: StockLevel =
    r.status === "LOW_STOCK" ? "low" : r.quantity !== null && r.quantity < 100 ? "medium" : "high";
  const location = [r.vendor.city, r.vendor.state].filter(Boolean).join(", ");
  const minutesOld = (Date.now() - new Date(r.updatedAt).getTime()) / 60_000;
  return {
    id: r.inventoryItemId,
    product: r.name,
    vendor: r.vendor.businessName,
    vendorId: r.vendor.id,
    vendorCity: r.vendor.city ?? "",
    category: r.category?.name ?? "General",
    distance: r.vendor.distanceKm !== null ? formatDistance(r.vendor.distanceKm) : null,
    location,
    stock: r.quantity ?? 0,
    qtyHidden: r.quantity === null,
    stockStatus,
    // A zero price means the vendor quotes on request (blood, bulk industrial).
    price: r.price !== null && r.price > 0 ? formatMoney(r.price, r.currency) : "Contact",
    unit: r.price !== null && r.price > 0 ? `/${r.unit}` : "",
    verified: r.vendor.verified,
    syncAge: minutesOld < 1 ? "just now" : timeAgo(r.updatedAt),
    live: minutesOld < 15,
    address: [r.vendor.addressLine1, r.vendor.city, r.vendor.state].filter(Boolean).join(", "),
    // Hidden or zero prices are "ask the vendor" — nothing to pay online.
    buy:
      r.price !== null && r.price > 0
        ? {
            inventoryItemId: r.inventoryItemId,
            name: r.name,
            vendor: r.vendor.businessName,
            vendorCity: r.vendor.city ?? "",
            unitPrice: r.price,
            currency: r.currency,
            unit: r.unit,
            stock: r.quantity,
          }
        : null,
  };
}

/** Waits for typing to pause before hitting the API. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [origin, setOrigin] = useState<SearchOrigin | null>(null);
  const [locating, setLocating] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imageSearchOpen, setImageSearchOpen] = useState(false);
  const [contacting, setContacting] = useState<string | null>(null);
  /** The result card opened by a click or Enter. */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  /** The product in the open Buy now dialog. */
  const [checkout, setCheckout] = useState<CheckoutItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveCategory("All");
      setSelectedIdx(0);
      setImageSearchOpen(false);
      setTimeout(() => inputRef.current?.focus(), 80);
      // Results are ranked by distance from the user, so find them first.
      // A GPS fix from earlier in the session is reused.
      if (origin?.source !== "gps") locate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Esc closes the checkout dialog first, then the search.
      if (checkout) setCheckout(null);
      else onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, checkout]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  const debouncedQuery = useDebounced(query.trim(), 250);
  const categorySlug = CATEGORIES.find((c) => c.label === activeCategory)?.slug ?? null;

  const { data, isFetching, isError } = useQuery({
    queryKey: ["discover", debouncedQuery, categorySlug, origin],
    // No origin, no search: every result is ranked by distance from it.
    enabled: open && !!user && debouncedQuery.length > 0 && !!origin,
    placeholderData: (previous) => previous,
    queryFn: () => {
      const params = new URLSearchParams({ q: debouncedQuery, limit: "30" });
      if (categorySlug) params.set("categorySlug", categorySlug);
      if (origin) {
        // No radiusKm: every match nationwide, nearest first.
        params.set("latitude", String(origin.lat));
        params.set("longitude", String(origin.lng));
        params.set("sort", "distance");
      }
      return api.get<DiscoverResult[]>(`/discover?${params.toString()}`);
    },
  });

  const { data: trending } = useQuery({
    queryKey: ["discover", "trending"],
    enabled: open && !!user,
    queryFn: () => api.get<{ term: string; searches: number }[]>("/discover/trending"),
  });

  const isSearching = !!origin && (isFetching || query.trim() !== debouncedQuery);
  const results: ResultRow[] = debouncedQuery ? (data ?? []).map(toRow) : [];
  const maxStock = Math.max(1, ...results.map((r) => r.stock));
  const stockPct = (v: ResultRow) =>
    v.qtyHidden ? (v.stockStatus === "low" ? 15 : 70) : Math.max(6, Math.round((v.stock / maxStock) * 100));

  const handleQueryChange = (val: string) => {
    setQuery(val);
    setSelectedIdx(0);
    setExpandedId(null);
  };

  /**
   * Asks the browser for a GPS fix. If that is unsupported, blocked or times
   * out, falls back to the city picked last time, or opens the picker.
   */
  function locate() {
    const fallBack = (reason: string) => {
      setLocating(false);
      const saved = readSavedCity();
      if (saved) {
        setOrigin((current) => current ?? saved);
      } else {
        setPickerOpen(true);
        toast({ title: reason, description: "Choose your city to see the nearest vendors." });
      }
    };
    if (!navigator.geolocation) {
      fallBack("Location unavailable");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Current location", source: "gps" });
        setLocating(false);
        setPickerOpen(false);
      },
      () => fallBack("Location blocked"),
      { timeout: 8000, maximumAge: 5 * 60_000 },
    );
  }

  function chooseCity(city: (typeof CITY_CENTRES)[number]) {
    setOrigin({ ...city, source: "city" });
    saveCity(city.label);
    setPickerOpen(false);
    setSelectedIdx(0);
  }

  /** Opens a conversation with the vendor, pre-filled with the product. */
  async function contactVendor(v: ResultRow) {
    if (!user) {
      onClose();
      router.push("/login?next=/");
      return;
    }
    setContacting(v.id);
    try {
      await api.post("/conversations", {
        vendorId: v.vendorId,
        subject: `Enquiry: ${v.product}`,
        body: `Hello ${v.vendor}, I found ${v.product} on Finder and would like to discuss availability.`,
      });
      toast({
        title: "Message sent",
        description: `${v.vendor} will reply in your Finder inbox.`,
      });
    } catch (err) {
      toast({
        title: "Could not reach vendor",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setContacting(null);
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // The checkout form needs Enter and arrows for itself.
      if (!open || checkout) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, results.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
      else if (e.key === "Enter" && results[selectedIdx]) {
        e.preventDefault();
        const id = results[selectedIdx].id;
        setExpandedId((current) => (current === id ? null : id));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, selectedIdx, checkout]);

  useEffect(() => {
    const el = resultsRef.current?.children[selectedIdx] as HTMLElement;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="search"
          data-testid="search-modal-backdrop"
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[6vh] px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-[#020812]/88 backdrop-blur-2xl" />

          <motion.div
            data-testid="search-modal-panel"
            className="relative w-full max-w-2xl flex flex-col overflow-hidden"
            style={{
              background: "linear-gradient(160deg, #0b1830 0%, #060d1f 60%, #040913 100%)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "1.5rem",
              boxShadow: "0 48px 140px -20px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.04), 0 0 100px -30px rgba(59,130,246,0.18)",
              maxHeight: "84vh",
            }}
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top shimmer line */}
            <div className="absolute -top-px left-1/2 -translate-x-1/2 w-[55%] h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

            {/* Search Input Row */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.05]">
              <div className="relative shrink-0 w-5 flex items-center justify-center">
                {isSearching
                  ? <Loader2 className="h-4.5 w-4.5 text-blue-400 animate-spin" />
                  : <Search className="h-4.5 w-4.5 text-slate-500" />}
              </div>
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  data-testid="search-modal-input"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  className="w-full bg-transparent text-white text-[17px] placeholder:text-slate-600 outline-none font-light tracking-[-0.01em]"
                  spellCheck={false}
                  autoComplete="off"
                />
                {!query && (
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={placeholderIdx}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.25 }}
                      className="absolute inset-0 flex items-center text-[17px] text-slate-600 font-light pointer-events-none"
                    >
                      {PLACEHOLDERS[placeholderIdx]}
                    </motion.span>
                  </AnimatePresence>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  data-testid="search-image-button"
                  onClick={() => setImageSearchOpen((o) => !o)}
                  aria-expanded={imageSearchOpen}
                  title="Search by image"
                  className={`p-1.5 rounded-lg border transition-colors ${
                    imageSearchOpen
                      ? "bg-blue-500/15 border-blue-500/30 text-blue-300"
                      : "bg-blue-500/[0.08] border-blue-500/20 text-blue-400 hover:bg-blue-500/[0.15]"
                  }`}
                >
                  <ScanSearch className="h-4 w-4" />
                </button>
                <button
                  data-testid="search-modal-close"
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-600 hover:text-slate-300 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Image search — placeholder. Planned flow: camera photo or upload →
                Claude vision names the product → that text runs through the
                normal proximity search, shown to the user so they can edit it. */}
            {imageSearchOpen && (
              <div data-testid="search-image-panel" className="px-5 py-4 border-b border-white/[0.05] bg-blue-500/[0.03]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <ScanSearch className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-slate-100">Image search</span>
                        <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300">
                          Coming soon
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">
                        Snap or upload a photo of a product and Finder will recognise it and show the nearest vendors
                        with it in stock.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImageSearchOpen(false)}
                    className="p-1 rounded-md text-slate-600 hover:text-slate-300 hover:bg-white/[0.06]"
                    aria-label="Close image search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex gap-2 mt-3 pl-12">
                  {[
                    { icon: Camera, label: "Take a photo" },
                    { icon: ImageUp, label: "Upload a photo" },
                  ].map(({ icon: Icon, label }) => (
                    <button
                      key={label}
                      type="button"
                      disabled
                      title="Coming soon"
                      className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 border border-white/[0.07] bg-white/[0.02] rounded-lg px-3 py-1.5 cursor-not-allowed"
                    >
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Category Tabs */}
            <div className="flex items-center gap-1 px-4 py-2.5 border-b border-white/[0.04] overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {CATEGORIES.map(({ label: cat }) => (
                <button
                  key={cat}
                  data-testid={`search-cat-${cat.replace(/\s|&/g, "-").toLowerCase()}`}
                  onClick={() => { setActiveCategory(cat); setSelectedIdx(0); }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium tracking-wide transition-all duration-150 ${
                    activeCategory === cat
                      ? "bg-blue-500/15 text-blue-300 border border-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                      : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] border border-transparent"
                  }`}
                >
                  {cat}
                </button>
              ))}
              <button
                type="button"
                data-testid="search-location-chip"
                onClick={() => setPickerOpen((o) => !o)}
                className={`ml-auto shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium border transition-all ${
                  origin
                    ? "bg-green-500/10 text-green-300 border-green-500/30"
                    : "text-slate-500 hover:text-slate-300 border-white/[0.06]"
                }`}
                title="Results are sorted nearest first — click to change location"
              >
                {locating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Navigation className="h-3 w-3" />}
                {origin ? `Near ${origin.label}` : locating ? "Locating…" : "Set location"}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
              <div className="shrink-0 text-[11px] text-slate-600 pl-3 font-medium tabular-nums">
                {results.length} result{results.length !== 1 ? "s" : ""}
              </div>
            </div>

            {/* Location picker — GPS, or a city centre when GPS is unavailable */}
            {pickerOpen && (
              <div data-testid="search-location-picker" className="px-4 py-3 border-b border-white/[0.04] space-y-2.5">
                <button
                  type="button"
                  onClick={locate}
                  disabled={locating}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-blue-300 hover:text-blue-200 disabled:opacity-60"
                >
                  {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
                  Use my current location
                </button>
                <div className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold">Or choose a city</div>
                <div className="flex flex-wrap gap-1.5">
                  {CITY_CENTRES.map((city) => (
                    <button
                      key={city.label}
                      type="button"
                      onClick={() => chooseCity(city)}
                      className={`px-2.5 py-1 rounded-full text-[11px] border transition-all ${
                        origin?.source === "city" && origin.label === city.label
                          ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                          : "text-slate-400 border-white/[0.07] hover:bg-white/[0.05] hover:text-slate-200"
                      }`}
                    >
                      {city.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Results List */}
            <div ref={resultsRef} className="overflow-y-auto flex-1 py-2" style={{ scrollbarWidth: "none" }}>
              {!debouncedQuery ? (
                <div className="px-5 py-8">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-600 font-semibold mb-3">
                    <TrendingUp className="h-3 w-3" /> Trending on Finder
                  </div>
                  {trending && trending.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {trending.map((t) => (
                        <button
                          key={t.term}
                          type="button"
                          onClick={() => handleQueryChange(t.term)}
                          className="px-3 py-1.5 rounded-full text-[12px] text-slate-300 bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.06] hover:border-blue-500/30 transition-all"
                        >
                          {t.term}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-slate-600">
                      Type a product, medicine, material or tool to see live stock from verified vendors.
                    </p>
                  )}
                </div>
              ) : !origin ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  {locating
                    ? <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />
                    : <MapPin className="h-6 w-6 text-slate-600" />}
                  <div className="text-slate-400 font-medium text-sm">
                    {locating ? "Finding your location…" : "Where are you searching from?"}
                  </div>
                  <div className="text-slate-600 text-xs">
                    {locating ? "Results are sorted nearest first." : "Choose a city above to see the nearest vendors."}
                  </div>
                </div>
              ) : isError ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-amber-500/70" />
                  <div className="text-slate-400 font-medium text-sm">Search is unavailable right now</div>
                  <div className="text-slate-600 text-xs">Please try again in a moment.</div>
                </div>
              ) : results.length === 0 && !isSearching ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
                    <Package className="h-6 w-6 text-slate-600" />
                  </div>
                  <div>
                    <div className="text-slate-400 font-medium text-sm">No results found</div>
                    <div className="text-slate-600 text-xs mt-1">Try a different product or category</div>
                  </div>
                </div>
              ) : (
                results.map((v, i) => {
                  const sc = STOCK_CONFIG[v.stockStatus];
                  const isSelected = selectedIdx === i;
                  const isExpanded = expandedId === v.id;
                  const isContact = v.price === "Contact";
                  const pct = stockPct(v);

                  return (
                    <motion.div
                      key={v.id}
                      data-testid={`search-result-${v.id}`}
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, delay: Math.min(i * 0.025, 0.18) }}
                      onMouseEnter={() => setSelectedIdx(i)}
                      onClick={() => setExpandedId(isExpanded ? null : v.id)}
                      aria-expanded={isExpanded}
                      className="mx-2 my-0.5 rounded-xl cursor-pointer transition-all duration-150"
                      style={isSelected ? {
                        background: "rgba(255,255,255,0.035)",
                        boxShadow: "inset 0 0 0 1px rgba(59,130,246,0.15), 0 0 20px -8px rgba(59,130,246,0.2)"
                      } : {}}
                    >
                      <div className="flex items-center gap-3.5 px-3.5 py-3">

                        {/* LEFT — Icon */}
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-150"
                          style={isSelected
                            ? { background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)" }
                            : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }
                          }
                        >
                          <Package className={`h-4 w-4 transition-colors ${isSelected ? "text-blue-400" : "text-slate-500"}`} />
                        </div>

                        {/* CENTER — Product info + inventory bar */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          {/* Title row */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[13px] font-semibold text-slate-100 truncate leading-tight">{v.product}</span>
                            <span className="shrink-0 text-[9px] uppercase tracking-widest bg-white/[0.04] border border-white/[0.07] text-slate-500 px-1.5 py-px rounded font-medium">
                              {v.category}
                            </span>
                            {v.verified && (
                              <span className="shrink-0 flex items-center gap-0.5 text-[10px] text-blue-400 font-medium">
                                <CheckCircle2 className="h-2.5 w-2.5" /> Verified
                              </span>
                            )}
                          </div>

                          {/* Vendor name */}
                          <div className="text-[11px] text-slate-500 truncate">
                            {v.vendor}{v.vendorCity && <span className="text-slate-600"> · {v.vendorCity}</span>}
                          </div>

                          {/* Distance, in words */}
                          <div data-testid={`search-distance-${v.id}`} className="flex items-center gap-1 text-[11px] text-slate-300">
                            <MapPin className="h-3 w-3 shrink-0 text-blue-400" />
                            {v.distance ? (
                              <span>
                                This product is <strong className="font-semibold text-white">{v.distance}</strong> away from{" "}
                                {/* A city pick is measured from its centre, so say so. */}
                                {origin?.source === "city" ? `${origin.label} centre` : "you"}
                              </span>
                            ) : (
                              <span className="text-slate-500">Distance unknown{v.location && ` · ${v.location}`}</span>
                            )}
                          </div>

                          {/* Inventory bar + quantity */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-[3px] bg-white/[0.06] rounded-full overflow-hidden max-w-[80px]">
                              <div
                                className={`h-full rounded-full ${sc.bar} transition-all duration-700`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <div className={`w-1.5 h-1.5 rounded-full ${sc.dot} animate-pulse ${sc.glow}`} />
                              <span className={`text-[11px] font-semibold tabular-nums ${sc.text}`}>
                                {v.qtyHidden ? "In stock" : v.stock.toLocaleString()}
                              </span>
                              {!v.qtyHidden && <span className="text-[10px] text-slate-600">{v.unit.replace("/", "") || "units"}</span>}
                            </div>
                          </div>

                          {/* Sync timestamp */}
                          <div className="flex items-center gap-1 text-[10px] text-slate-600">
                            <Clock className="h-2.5 w-2.5 shrink-0" />
                            Updated {v.syncAge}
                            {v.live && (
                              <span className="ml-1 text-green-500/70 font-medium">· Live</span>
                            )}
                            {v.stockStatus === "low" && (
                              <span className="ml-1 flex items-center gap-0.5 text-amber-500/80">
                                <AlertTriangle className="h-2.5 w-2.5" /> Low stock alert
                              </span>
                            )}
                          </div>
                        </div>

                        {/* RIGHT — Price + distance + CTA */}
                        <div className="flex flex-col items-end gap-2 shrink-0 min-w-[100px]">
                          {isContact ? (
                            <button type="button" disabled={contacting === v.id} onClick={(e) => { e.stopPropagation(); void contactVendor(v); }} className="disabled:opacity-60 text-[11px] font-semibold text-blue-300 border border-blue-500/25 bg-blue-500/[0.08] hover:bg-blue-500/[0.15] hover:border-blue-500/40 rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap">
                              <Phone className="h-3 w-3" />
                              Contact
                            </button>
                          ) : (
                            <>
                              <div className="text-right">
                                <div className="text-[15px] font-bold text-white tabular-nums leading-none">{v.price}</div>
                                <div className="text-[10px] text-slate-600 mt-0.5 leading-none">{v.unit}</div>
                              </div>
                              {v.buy && (
                                <button type="button" data-testid={`search-buy-${v.id}`} onClick={(e) => { e.stopPropagation(); setCheckout(v.buy); }} className="text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap shadow-[0_0_14px_-4px_rgba(59,130,246,0.6)]">
                                  <ShoppingCart className="h-3 w-3" />
                                  Buy now
                                </button>
                              )}
                            </>
                          )}
                        </div>

                      </div>

                      {/* EXPANDED — where it is, and how to reach the vendor */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            data-testid={`search-result-details-${v.id}`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="mx-3.5 mb-3 pt-3 border-t border-white/[0.06] space-y-3 cursor-default">
                              <div className="flex items-start gap-2 text-[12px] text-slate-300">
                                <MapPin className="h-3.5 w-3.5 shrink-0 mt-px text-slate-500" />
                                <div>
                                  <div className="text-slate-200 font-medium">{v.vendor}</div>
                                  <div className="text-slate-500">{v.address || "Address not provided"}</div>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {v.buy && (
                                  <button
                                    type="button"
                                    onClick={() => setCheckout(v.buy)}
                                    className="text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors"
                                  >
                                    <ShoppingCart className="h-3 w-3" /> Buy now
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={contacting === v.id}
                                  onClick={() => void contactVendor(v)}
                                  className="disabled:opacity-60 text-[11px] font-semibold text-blue-300 border border-blue-500/25 bg-blue-500/[0.08] hover:bg-blue-500/[0.15] rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors"
                                >
                                  <MessageSquare className="h-3 w-3" /> Message vendor
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/[0.05] px-5 py-3 flex items-center justify-between bg-white/[0.01]">
              <div className="flex items-center gap-4 text-[10px] text-slate-600">
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-white/[0.05] border border-white/[0.07] rounded text-slate-500 font-mono text-[9px]">↑↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-white/[0.05] border border-white/[0.07] rounded text-slate-500 font-mono text-[9px]">esc</kbd>
                  close
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_6px_rgba(74,222,128,0.6)]" />
                <span className="text-[10px] text-slate-600">Nearest first · Verified vendors only</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      {open && checkout && (
        <CheckoutDialog key="checkout" item={checkout} onClose={() => setCheckout(null)} />
      )}
    </AnimatePresence>
  );
}
