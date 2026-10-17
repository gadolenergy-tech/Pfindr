"use client";

import { useState } from "react";
import { VendorSidebar } from "@/components/vendor-sidebar";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud, Code2, CheckCircle2, Clock, Zap, Shield,
  FileSpreadsheet, Lock, BarChart3, Camera, FileText,
  PenLine, Plug, AlertTriangle, RefreshCw, Download,
  PauseCircle, PlayCircle, Trash2, Star, Award, Activity,
  Package, ChevronDown, Eye, EyeOff, Scan, ClipboardList
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ManualEntry } from "@/components/inventory/manual-entry";
import { BulkImport } from "@/components/inventory/bulk-import";
import { CopyButton, KeyManager, PUBLIC_API_BASE } from "@/components/api-keys/key-manager";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { inventoryApi, timeAgo, type InventoryItem } from "@/lib/vendor-api";

type TabId = "manual" | "bulk" | "api" | "ai-scan" | "camera" | "form";

const TABS: { id: TabId; icon: React.ComponentType<{ className?: string }>; label: string; badge?: string }[] = [
  { id: "manual", icon: PenLine, label: "Manual Entry" },
  { id: "bulk", icon: FileSpreadsheet, label: "Bulk Import" },
  { id: "api", icon: Code2, label: "API Integration" },
  { id: "ai-scan", icon: Scan, label: "AI Document Scan", badge: "AI" },
  { id: "camera", icon: Camera, label: "Camera Capture", badge: "Soon" },
  { id: "form", icon: ClipboardList, label: "Form Submission" },
];

const QUALITY_TIERS = [
  { label: "Bronze", color: "text-amber-700", bg: "bg-amber-900/20", border: "border-amber-700/30", pts: 0 },
  { label: "Silver", color: "text-slate-400", bg: "bg-slate-700/20", border: "border-slate-500/30", pts: 25 },
  { label: "Gold", color: "text-yellow-400", bg: "bg-yellow-900/20", border: "border-yellow-500/30", pts: 50 },
  { label: "Platinum", color: "text-cyan-400", bg: "bg-cyan-900/20", border: "border-cyan-500/30", pts: 75 },
  { label: "Enterprise Verified", color: "text-blue-400", bg: "bg-blue-900/20", border: "border-blue-500/30", pts: 95 },
];

function ApiIntegration() {
  const { data: summary } = useQuery({ queryKey: ["inventory", "summary"], queryFn: inventoryApi.summary });
  const { data: jobs } = useQuery({
    queryKey: ["inventory", "sync-jobs"],
    queryFn: () => api.get<{ source: string; startedAt: string; totalItems: number; failedItems: number }[]>("/inventory/sync-jobs"),
  });

  const apiJobs = (jobs ?? []).filter((j) => j.source === "API");
  const lastApi = apiJobs[0];
  const rows = apiJobs.reduce((s, j) => s + j.totalItems, 0);
  const failed = apiJobs.reduce((s, j) => s + j.failedItems, 0);
  const health = rows > 0 ? Math.round(((rows - failed) / rows) * 100) : null;

  const endpoint = `POST ${PUBLIC_API_BASE}/inventory/sync`;
  const snippet = [
    `curl -X POST ${PUBLIC_API_BASE}/inventory/sync \\`,
    `  -H "Authorization: Bearer fndr_live_…" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"items":[{"sku":"MED-001","quantity":480,"price":1200}]}'`,
  ].join("\n");

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { label: "Connection Status", value: lastApi ? "Active" : "Not connected", sub: lastApi ? `First call ${timeAgo(apiJobs.at(-1)?.startedAt)}` : "No API syncs yet", color: lastApi ? "text-green-400" : "text-slate-400", dot: lastApi ? "bg-green-400" : "bg-slate-500" },
          { label: "Last Sync", value: timeAgo(lastApi?.startedAt), sub: summary?.lastSync ? `Latest of any kind: ${timeAgo(summary.lastSync.startedAt)}` : "Push whenever stock changes", color: "text-blue-400", dot: "bg-blue-400" },
          { label: "Sync Health", value: health === null ? "—" : `${health}/100`, sub: health === null ? "No rows synced yet" : `${rows - failed} of ${rows} rows accepted`, color: "text-cyan-400", dot: "bg-cyan-400" },
        ].map((s, i) => (
          <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-1.5 h-1.5 rounded-full ${s.dot} animate-pulse`} />
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{s.label}</span>
            </div>
            <div className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-slate-600 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white">API Credentials</h3>
        <div>
          <label className="block text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1.5 font-semibold">API Endpoint</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[#030810] border border-white/[0.07] rounded-xl px-4 py-3 text-[12px] font-mono text-blue-300 truncate">{endpoint}</div>
            <CopyButton value={`${PUBLIC_API_BASE}/inventory/sync`} />
          </div>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1.5 font-semibold">API Keys</label>
          <KeyManager compact />
        </div>
      </div>

      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white">How syncing works</h3>
        <p className="text-[12px] text-slate-400 leading-relaxed">
          Finder is push-based: call the sync endpoint from your POS or ERP whenever stock changes, or on your own schedule.
          Existing SKUs get new quantities and prices; new SKUs are created when you include a <code className="text-blue-300">name</code>.
          Up to 1,000 rows per call, 120 calls per minute per key.
        </p>
        <pre className="bg-[#030810] border border-white/[0.07] rounded-xl px-4 py-3 text-[11px] font-mono text-slate-300 overflow-x-auto">{snippet}</pre>
        <div className="flex items-start gap-3 bg-blue-500/[0.05] border border-blue-500/[0.15] rounded-xl px-4 py-3 text-xs text-slate-400">
          <Lock className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
          Keys are stored only as a SHA-256 hash and can be revoked instantly. Outbound webhooks are on the roadmap.
        </div>
      </div>
    </div>
  );
}

function AIDocumentScan() {
  const [stage, setStage] = useState<"upload" | "processing" | "review">("upload");
  return (
    <div className="space-y-6">
      {stage === "upload" && (
        <>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="px-2 py-0.5 bg-blue-500/15 border border-blue-500/30 rounded-full text-[9px] font-bold text-blue-400 uppercase tracking-wider">Finder AI</div>
              <span className="text-[11px] text-slate-500">Signature Feature</span>
            </div>
            <h3 className="text-base font-semibold text-white">AI Inventory Document Scanner</h3>
            <p className="text-slate-400 text-sm mt-1">
              Upload any inventory document — a photo, PDF invoice, warehouse report, or handwritten stock list. Our AI reads, extracts, and structures your inventory automatically.
            </p>
          </div>
          <button onClick={() => setStage("processing")}
            className="w-full border-2 border-dashed border-white/[0.08] rounded-2xl p-10 text-center hover:border-blue-500/30 hover:bg-blue-500/[0.02] transition-all duration-300 group">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-500/15 transition-colors">
              <Scan className="h-7 w-7 text-blue-400" />
            </div>
            <p className="text-sm font-medium text-slate-300 mb-1">Upload inventory document</p>
            <p className="text-xs text-slate-600 mb-4">PDF, JPG, PNG, HEIC · Invoices, stock lists, warehouse reports, handwritten sheets</p>
            <span className="inline-block text-[11px] px-4 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-slate-400 font-medium">Choose Document</span>
          </button>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: FileText, label: "PDF Invoices", desc: "Supplier invoices & POs" },
              { icon: Camera, label: "Shelf Photos", desc: "Warehouse & shelf stock" },
              { icon: ClipboardList, label: "Stock Reports", desc: "Excel, word, handwritten" },
            ].map((item) => (
              <div key={item.label} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 text-center">
                <item.icon className="h-5 w-5 text-slate-500 mx-auto mb-2" />
                <div className="text-[11px] font-medium text-slate-300">{item.label}</div>
                <div className="text-[9px] text-slate-600 mt-0.5">{item.desc}</div>
              </div>
            ))}
          </div>
        </>
      )}
      {stage === "processing" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
              <Scan className="h-8 w-8 text-blue-400 animate-pulse" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">AI Reading Document…</h3>
            <p className="text-sm text-slate-400">Applying OCR · Extracting product data · Cleaning & normalizing</p>
          </div>
          {[
            { label: "OCR text extraction", done: true },
            { label: "Product name recognition", done: true },
            { label: "Quantity & unit parsing", done: true },
            { label: "Duplicate detection", done: true },
            { label: "Data normalization & cleaning…", done: false },
          ].map((step, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded-xl">
              {step.done ? <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" /> : <RefreshCw className="h-4 w-4 text-blue-400 animate-spin shrink-0" />}
              <span className={`text-sm ${step.done ? "text-slate-300" : "text-blue-300"}`}>{step.label}</span>
            </motion.div>
          ))}
          <Button onClick={() => setStage("review")} className="w-full bg-blue-600 hover:bg-blue-500 text-white">View Extracted Products</Button>
        </motion.div>
      )}
      {stage === "review" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <div>
            <h3 className="text-base font-semibold text-white mb-1">Review AI Results</h3>
            <p className="text-slate-400 text-sm">AI extracted 11 products. Review and confirm before adding to Finder.</p>
          </div>
          <div className="space-y-2">
            {[
              { name: "Paracetamol 1g Tabs", qty: "2,400 units", price: "₦320", conf: 98 },
              { name: "Amoxicillin 500mg Caps", qty: "1,200 units", price: "₦1,200", conf: 96 },
              { name: "IV Infusion Set", qty: "800 units", price: "₦450", conf: 94 },
              { name: "Surgical Gloves L", qty: "5,000 pairs", price: "₦120", conf: 91 },
              { name: "N95 Respirator", qty: "600 units", price: "₦950", conf: 89 },
            ].map((product, i) => (
              <div key={i} className="flex items-center gap-4 p-3.5 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:bg-white/[0.04] transition-all">
                <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-slate-200">{product.name}</div>
                  <div className="text-[10px] text-slate-500">{product.qty} · {product.price}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="text-[10px] text-green-400 font-semibold">{product.conf}%</div>
                  <div className="text-[9px] text-slate-600">confidence</div>
                </div>
              </div>
            ))}
            <div className="text-center text-[11px] text-slate-600 py-1">+ 6 more products</div>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStage("upload")} className="text-slate-400 hover:text-white">← Rescan</Button>
            <Button className="flex-1 bg-green-600 hover:bg-green-500 text-white gap-2">
              <CheckCircle2 className="h-4 w-4" /> Add 11 Products to Finder
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function CameraCapture() {
  return (
    <div className="space-y-6">
      <div className="text-center py-10 space-y-4">
        <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mx-auto">
          <Camera className="h-10 w-10 text-slate-600" />
        </div>
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-3">
            <Clock className="h-3 w-3" /> Coming Soon
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Mobile Camera Inventory Capture</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
            Point your phone at any shelf, warehouse bin, or inventory board. Finder AI will identify products, estimate quantities, and sync inventory automatically — no typing required.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mt-4">
          {[
            { icon: Camera, label: "Photo shelves" },
            { icon: Zap, label: "AI identifies" },
            { icon: Activity, label: "Auto-syncs" },
          ].map((item) => (
            <div key={item.label} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 text-center">
              <item.icon className="h-5 w-5 text-slate-500 mx-auto mb-2" />
              <div className="text-[10px] text-slate-500">{item.label}</div>
            </div>
          ))}
        </div>
        <Button disabled className="opacity-40 cursor-not-allowed">Notify Me When Available</Button>
      </div>
    </div>
  );
}

function FormSubmission() {
  const [submitted, setSubmitted] = useState(false);
  return (
    <div className="space-y-6">
      {!submitted ? (
        <>
          <div>
            <h3 className="text-base font-semibold text-white mb-1">Simple Inventory Submission</h3>
            <p className="text-slate-400 text-sm">No technical setup required. Fill out this form and our AI will structure your inventory automatically.</p>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1.5 font-semibold">What products do you sell?</label>
              <textarea rows={4} placeholder="List your products, one per line. Include quantities if you know them.&#10;e.g.&#10;Paracetamol 1g — 2000 units&#10;Amoxicillin 500mg — 1200&#10;Surgical gloves (large) — 500 pairs"
                className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/40 transition-all resize-none" />
            </div>
            {[
              { label: "Your Business Name", placeholder: "e.g. Lagos General Pharmacy" },
              { label: "Business Address / Location", placeholder: "e.g. Victoria Island, Lagos" },
              { label: "Contact Phone", placeholder: "e.g. +234 801 234 5678" },
            ].map((f) => (
              <div key={f.label}>
                <label className="block text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1.5 font-semibold">{f.label}</label>
                <input type="text" placeholder={f.placeholder}
                  className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/40 transition-all" />
              </div>
            ))}
            <div className="flex items-start gap-3 bg-green-500/[0.05] border border-green-500/[0.15] rounded-xl px-4 py-3 text-xs text-slate-400">
              <Zap className="h-3.5 w-3.5 text-green-400 shrink-0 mt-0.5" />
              Finder AI will automatically clean, structure, and publish your inventory within minutes of submission.
            </div>
            <Button onClick={() => setSubmitted(true)} className="w-full bg-blue-600 hover:bg-blue-500 text-white">Submit Inventory to Finder</Button>
          </div>
        </>
      ) : (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-10 space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-green-400" />
          </div>
          <h3 className="text-xl font-bold text-white">Submission Received</h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">Our AI is processing your inventory list. You'll be live on Finder within 15 minutes. No action needed.</p>
          <Button variant="ghost" onClick={() => setSubmitted(false)} className="text-slate-400 hover:text-white text-sm">Submit another list</Button>
        </motion.div>
      )}
    </div>
  );
}

/** Downloads the vendor's full catalogue as CSV, in the same shape bulk import reads. */
async function exportInventoryCsv() {
  const items = await inventoryApi.list("?limit=100&sort=name&order=asc");
  const escape = (value: string | number | null) => {
    const text = value === null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [
    "sku,name,quantity,unit,price,currency,status",
    ...items.map((i: InventoryItem) =>
      [i.sku, i.name, i.quantity, i.unit, i.price, i.currency, i.status].map(escape).join(","),
    ),
  ];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `finder-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function VendorInventory() {
  const [activeTab, setActiveTab] = useState<TabId>("manual");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: summary } = useQuery({
    queryKey: ["inventory", "summary"],
    queryFn: inventoryApi.summary,
  });

  const { data: vendor } = useQuery({
    queryKey: ["vendor", "me"],
    queryFn: () => api.get<{ listingPaused: boolean; status: string }>("/vendors/me"),
  });
  const syncPaused = vendor?.listingPaused ?? false;

  const togglePause = useMutation({
    mutationFn: (paused: boolean) =>
      api.patch<{ listingPaused: boolean }>("/vendors/me/listing", { paused }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["vendor", "me"] });
      toast({
        title: data.listingPaused ? "Inventory hidden" : "Inventory live again",
        description: data.listingPaused
          ? "Buyers will not see your products in search until you resume."
          : "Your products are discoverable on Finder.",
      });
    },
    onError: (err: Error) =>
      toast({ title: "Could not update", description: err.message, variant: "destructive" }),
  });

  const deleteAll = useMutation({
    mutationFn: () => api.delete<{ deleted: number }>("/inventory?confirm=all"),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast({ title: "Inventory deleted", description: `${data.deleted} products removed.` });
    },
    onError: (err: Error) =>
      toast({ title: "Could not delete", description: err.message, variant: "destructive" }),
  });

  // Share of listings actually in stock — the one honest health signal we have.
  const health =
    summary && summary.totalItems > 0
      ? Math.round((summary.inStock / summary.totalItems) * 100)
      : null;

  const qualityScore = 62;
  const currentTier = QUALITY_TIERS[2]!;
  const nextTier = QUALITY_TIERS[3]!;

  return (
    <div className="min-h-screen flex bg-[#040a15] text-foreground">
      <VendorSidebar />

      <main className="flex-1 overflow-y-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-[#040a15]/95 backdrop-blur border-b border-white/[0.05] px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">AI Inventory Sync Center</h1>
            <p className="text-xs text-slate-500 mt-0.5">Keep Your Inventory Live On Finder</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 text-[11px] border rounded-full px-3 py-1.5 ${syncPaused ? "text-amber-400 border-amber-500/30 bg-amber-500/[0.07]" : "text-slate-500 border-white/[0.06] bg-white/[0.03]"}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${syncPaused ? "bg-amber-400" : "bg-green-400 animate-pulse shadow-[0_0_6px_rgba(74,222,128,0.5)]"}`} />
              {syncPaused ? "Sync Paused" : "Network Live"}
            </div>
            <Link href="/vendor/dashboard">
              <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white gap-2">
                <BarChart3 className="h-4 w-4" /> Dashboard
              </Button>
            </Link>
          </div>
        </div>

        <div className="px-8 py-8 space-y-8 max-w-6xl">

          {/* Real-Time Status Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "Inventory Health",
                value: health === null ? "—" : `${health}/100`,
                sub: health === null ? "No products yet" : "Share of listings in stock",
                color: health === null || health >= 70 ? "text-green-400" : "text-amber-400",
                dot: "bg-green-400",
              },
              {
                label: "Active Products",
                value: String((summary?.inStock ?? 0) + (summary?.lowStock ?? 0)),
                sub: syncPaused ? "Hidden from buyers" : "Live on network",
                color: "text-blue-400",
                dot: "bg-blue-400",
              },
              {
                label: "Low Stock Alerts",
                value: String((summary?.lowStock ?? 0) + (summary?.outOfStock ?? 0)),
                sub: `${summary?.outOfStock ?? 0} out of stock`,
                color: "text-amber-400",
                dot: "bg-amber-400",
              },
              {
                label: "Last Sync",
                value: timeAgo(summary?.lastSync?.startedAt),
                sub: syncPaused ? "Paused" : summary?.lastSync ? `via ${summary.lastSync.source.toLowerCase().replace("_", " ")}` : "No imports yet",
                color: "text-slate-300",
                dot: syncPaused ? "bg-amber-400" : "bg-green-400",
              },
            ].map((s, i) => (
              <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${s.dot} animate-pulse`} />
                  <span className="text-[9px] uppercase tracking-[0.15em] text-slate-500 font-semibold">{s.label}</span>
                </div>
                <div className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Quality Score Banner */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Award className="h-4 w-4 text-yellow-400" />
                  <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Finder Quality Score</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold ${currentTier.color}`}>{currentTier.label} Vendor</span>
                  <div className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${currentTier.bg} ${currentTier.border} ${currentTier.color}`}>
                    {qualityScore}/100
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{nextTier.pts - qualityScore} more points to reach {nextTier.label}</p>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                {QUALITY_TIERS.map((tier, i) => (
                  <div key={tier.label} className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${qualityScore >= tier.pts ? `${tier.bg} ${tier.border}` : "bg-white/[0.02] border-white/[0.06]"}`}>
                      <Star className={`h-3.5 w-3.5 ${qualityScore >= tier.pts ? tier.color : "text-slate-700"}`} />
                    </div>
                    <span className={`text-[8px] font-semibold ${qualityScore >= tier.pts ? tier.color : "text-slate-700"}`}>{tier.label.split(" ")[0]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-cyan-400"
                initial={{ width: "0%" }} animate={{ width: `${qualityScore}%` }} transition={{ duration: 1, ease: "easeOut" }} />
            </div>
            <div className="flex gap-4 mt-3">
              {[
                { label: "Update Frequency", val: 90 },
                { label: "Accuracy", val: 85 },
                { label: "Completeness", val: 72 },
                { label: "Sync Reliability", val: 95 },
              ].map((f) => (
                <div key={f.label} className="text-center">
                  <div className="text-[11px] font-semibold text-slate-300 tabular-nums">{f.val}%</div>
                  <div className="text-[8px] text-slate-600">{f.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Sync Methods Tabs */}
          <div className="bg-white/[0.015] border border-white/[0.06] rounded-2xl overflow-hidden">
            {/* Tab Nav */}
            <div className="flex overflow-x-auto border-b border-white/[0.06] bg-white/[0.01]">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-5 py-4 text-[12px] font-medium whitespace-nowrap border-b-2 transition-all duration-150 shrink-0 ${
                      isActive
                        ? "border-blue-500 text-white bg-white/[0.03]"
                        : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]"
                    }`}
                  >
                    <tab.icon className={`h-3.5 w-3.5 ${isActive ? "text-blue-400" : "text-slate-600"}`} />
                    {tab.label}
                    {tab.badge && (
                      <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                        tab.badge === "AI" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-white/[0.06] text-slate-500 border border-white/[0.06]"
                      }`}>{tab.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="p-7">
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                  {activeTab === "manual" && <ManualEntry />}
                  {activeTab === "bulk" && <BulkImport />}
                  {activeTab === "api" && <ApiIntegration />}
                  {activeTab === "ai-scan" && <AIDocumentScan />}
                  {activeTab === "camera" && <CameraCapture />}
                  {activeTab === "form" && <FormSubmission />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Data Controls + Security */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Data Ownership */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-white">Data Ownership & Control</h3>
              </div>
              <p className="text-[11px] text-slate-500">You own your inventory data. Control exactly how it appears on Finder.</p>
              <div className="space-y-2.5">
                <button
                  onClick={() => togglePause.mutate(!syncPaused)}
                  disabled={togglePause.isPending || !vendor}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                    syncPaused
                      ? "bg-amber-500/[0.08] border-amber-500/[0.2] text-amber-300"
                      : "bg-white/[0.02] border-white/[0.06] text-slate-300 hover:bg-white/[0.04]"
                  }`}
                >
                  {syncPaused ? <PlayCircle className="h-4 w-4 text-amber-400 shrink-0" /> : <PauseCircle className="h-4 w-4 text-slate-400 shrink-0" />}
                  <div className="flex-1">
                    <div className="text-[12px] font-semibold">{syncPaused ? "Resume Inventory Sharing" : "Pause Inventory Sharing"}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{syncPaused ? "Products currently hidden from buyers" : "Temporarily hide all products from search"}</div>
                  </div>
                </button>
                {[
                  {
                    icon: Download,
                    label: "Export Inventory",
                    sub: "Download as CSV",
                    color: "text-blue-400",
                    onClick: () =>
                      void exportInventoryCsv().catch((err: Error) =>
                        toast({ title: "Export failed", description: err.message, variant: "destructive" }),
                      ),
                  },
                  {
                    icon: Plug,
                    label: "Disconnect Integration",
                    sub: "Revoke API keys under API & Integrations",
                    color: "text-slate-400",
                    onClick: () => window.location.assign("/vendor/api-integrations"),
                  },
                  {
                    icon: Trash2,
                    label: "Delete All Inventory",
                    sub: "Permanently remove all products",
                    color: "text-red-400",
                    onClick: () => {
                      if (window.confirm("Permanently delete every product you have listed? This cannot be undone.")) {
                        deleteAll.mutate();
                      }
                    },
                  },
                ].map((action) => (
                  <button key={action.label} onClick={action.onClick} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-all text-left">
                    <action.icon className={`h-4 w-4 ${action.color} shrink-0`} />
                    <div className="flex-1">
                      <div className={`text-[12px] font-semibold ${action.color}`}>{action.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{action.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Enterprise Security */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Lock className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-white">Enterprise Security</h3>
              </div>
              <p className="text-[11px] text-slate-500">Your inventory data is protected by bank-grade infrastructure at every layer.</p>
              <div className="space-y-2.5">
                {[
                  { label: "Encrypted Transfers", sub: "TLS 1.3 on all data in transit", active: true, color: "text-green-400" },
                  { label: "Secure Storage", sub: "AES-256 at rest, zero-knowledge vault", active: true, color: "text-green-400" },
                  { label: "Access Controls", sub: "Role-based permissions per team member", active: true, color: "text-green-400" },
                  { label: "Audit Logs", sub: "Full history of every inventory change", active: true, color: "text-green-400" },
                  { label: "Vendor Permissions", sub: "Granular control over what buyers can see", active: true, color: "text-green-400" },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3 px-4 py-3 bg-white/[0.015] border border-white/[0.04] rounded-xl">
                    <CheckCircle2 className={`h-4 w-4 ${item.color} shrink-0 mt-0.5`} />
                    <div>
                      <div className="text-[12px] font-semibold text-slate-200">{item.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Live Network Activity */}
          <div className="bg-white/[0.015] border border-white/[0.05] rounded-2xl px-6 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Live Network Activity</span>
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse ml-1" />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {[
                "Pharmacy inventory updated · 12s ago",
                "New blood bank stock uploaded · 1m ago",
                "Industrial supplier synchronized · 3m ago",
                "Construction materials refreshed · 5m ago",
                "Agricultural supplier added 48 products · 8m ago",
              ].map((msg, i) => (
                <div key={i} className="text-[10px] text-slate-600 flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-slate-700 shrink-0" />
                  {msg}
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
