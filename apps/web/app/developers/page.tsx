"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import Link from "next/link";
import {
  Book, KeyRound, Terminal, Webhook, Package, Search, MapPin, FlaskConical,
  History, Activity, Code2, Copy, CheckCircle2, ExternalLink, ArrowRight, Zap, Shield, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Section = "overview" | "auth" | "search-api" | "inventory-api" | "vendor-api" | "location-api" | "webhooks" | "sdks" | "sandbox" | "changelog" | "status";

const NAV_ITEMS: { id: Section; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { id: "overview", icon: Book, label: "Overview" },
  { id: "auth", icon: KeyRound, label: "Authentication" },
  { id: "search-api", icon: Search, label: "Search API" },
  { id: "inventory-api", icon: Package, label: "Inventory API" },
  { id: "vendor-api", icon: Code2, label: "Vendor API" },
  { id: "location-api", icon: MapPin, label: "Location API" },
  { id: "webhooks", icon: Webhook, label: "Webhooks" },
  { id: "sdks", icon: Terminal, label: "SDK Downloads" },
  { id: "sandbox", icon: FlaskConical, label: "Sandbox" },
  { id: "changelog", icon: History, label: "Changelog" },
  { id: "status", icon: Activity, label: "System Status" },
];

function CodeBlock({ code, language = "json" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative bg-[#020710] border border-white/[0.07] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.05]">
        <span className="text-[10px] text-slate-600 font-mono uppercase">{language}</span>
        <button onClick={() => { navigator.clipboard.writeText(code).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-white transition-colors">
          {copied ? <CheckCircle2 className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="px-4 py-4 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">{code}</pre>
    </div>
  );
}

function EndpointRow({ method, path, desc }: { method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"; path: string; desc: string }) {
  const colors: Record<string, string> = { GET: "text-green-400 bg-green-500/10 border-green-500/20", POST: "text-blue-400 bg-blue-500/10 border-blue-500/20", PUT: "text-amber-400 bg-amber-500/10 border-amber-500/20", DELETE: "text-red-400 bg-red-500/10 border-red-500/20", PATCH: "text-violet-400 bg-violet-500/10 border-violet-500/20" };
  return (
    <div className="flex items-center gap-4 p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl hover:bg-white/[0.04] transition-all">
      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border shrink-0 ${colors[method]}`}>{method}</span>
      <span className="font-mono text-[11px] text-cyan-300 flex-1">{path}</span>
      <span className="text-[10px] text-slate-500 hidden sm:block">{desc}</span>
    </div>
  );
}

/** The public API base. Set NEXT_PUBLIC_API_URL to the API host in each environment. */
const API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5020"}/api/v1`;

const QUICK_START = [
  "// 1. Create a key: Vendor portal → API & Integrations → New API key",
  "// 2. Call the API from your server — never from browser code",
  `const res = await fetch("${API_BASE}/search?q=Amoxicillin&latitude=6.5244&longitude=3.3792", {`,
  "  headers: { Authorization: `Bearer ${process.env.FINDER_API_KEY}` },",
  "});",
  "const { ok, data, meta } = await res.json();",
].join("\n");

const SEARCH_EXAMPLE = [
  `const res = await fetch("${API_BASE}/search?" + new URLSearchParams({`,
  '  q: "Amoxicillin 500mg",',
  '  latitude: "6.5244",',
  '  longitude: "3.3792",',
  '  radiusKm: "10",            // optional cutoff; omit to rank all by distance',
  '  categorySlug: "healthcare",',
  '  inStockOnly: "true",       // default true',
  '  sort: "distance",          // relevance | distance | price | quantity',
  '}), { headers: { Authorization: "Bearer fndr_live_..." } });',
].join("\n");

const SEARCH_RESPONSE = `{
  "ok": true,
  "data": [
    {
      "inventoryItemId": "cmu9oqj900009b8g8dno5blce",
      "name": "Amoxicillin 500mg",
      "quantity": 2400,            // null if the vendor hides stock levels
      "unit": "pack",
      "price": 1200,               // null if the vendor hides pricing
      "currency": "NGN",
      "status": "IN_STOCK",
      "updatedAt": "2026-09-21T10:42:00.000Z",
      "category": { "name": "Healthcare", "slug": "healthcare" },
      "vendor": {
        "id": "cmu9oqj8o0008b8g89u2q9hld",
        "businessName": "Citadel Pharmacy",
        "city": "Port Harcourt",
        "state": "Rivers",
        "rating": 4.8,
        "verified": true,
        "distanceKm": 4.2
      }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 14, "totalPages": 1 }
}`;

const SCOPES = `SEARCH_READ      GET    /search, /search/nearby, /search/suggestions
INVENTORY_READ   GET    /inventory, /inventory/:id, /inventory/history
INVENTORY_WRITE  POST   /inventory, /inventory/sync, /inventory/bulk
                 PATCH  /inventory/:id
                 DELETE /inventory/:id
ORDERS_READ      GET    /orders

Limit: 120 requests per minute per key.`;

export default function DeveloperPortal() {
  const [activeSection, setActiveSection] = useState<Section>("overview");

  const renderContent = () => {
    switch (activeSection) {
      case "overview":
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Finder Developer Portal</h1>
              <p className="text-slate-400 leading-relaxed">
                Build on top of Finder's AI-powered inventory discovery infrastructure. Our APIs give you programmatic access to real-time inventory data, vendor information, AI-powered search, and location-based availability across Finder Network.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { icon: Zap, title: "Simple & Predictable", desc: "Plain JSON over HTTPS. Every response uses the same { ok, data, meta } envelope.", color: "text-amber-400" },
                { icon: Shield, title: "Secure by Default", desc: "Scoped API keys, hashed at rest and revocable instantly, with per-key rate limits.", color: "text-blue-400" },
                { icon: Globe, title: "Global Infrastructure", desc: "Multi-region deployment ready for enterprise and government scale.", color: "text-green-400" },
              ].map((f) => (
                <div key={f.title} className="p-5 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
                  <f.icon className={`h-5 w-5 ${f.color} mb-3`} />
                  <div className="text-[12px] font-semibold text-white mb-1">{f.title}</div>
                  <div className="text-[11px] text-slate-500 leading-relaxed">{f.desc}</div>
                </div>
              ))}
            </div>
            <div>
              <h2 className="text-base font-semibold text-white mb-3">Quick Start</h2>
              {/* No SDK is published yet — never point developers at an unregistered package name. */}
              <CodeBlock language="javascript" code={QUICK_START} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white mb-3">Base URL</h2>
              <CodeBlock language="text" code={API_BASE} />
              <p className="text-[11px] text-slate-500 mt-2">A separate sandbox is on the roadmap. Until then, test against a second vendor account.</p>
            </div>
          </div>
        );

      case "auth":
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Authentication</h1>
              <p className="text-slate-400">Every request is authenticated with a scoped API key. Create and revoke keys in the vendor portal under API &amp; Integrations. OAuth 2.0 is on the roadmap.</p>
            </div>
            <div>
              <h2 className="text-base font-semibold text-white mb-3">API Key Authentication</h2>
              <p className="text-[12px] text-slate-500 mb-3">Pass your API key in the <code className="text-cyan-400 bg-cyan-500/10 px-1 rounded">Authorization</code> header with every request.</p>
              <CodeBlock language="http" code={`GET ${API_BASE}/search?q=Paracetamol\nAuthorization: Bearer fndr_live_your_api_key_here`} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white mb-3">Scopes</h2>
              <p className="text-[12px] text-slate-500 mb-3">Each key carries only the scopes you grant it. Calls outside those scopes return <code className="text-cyan-400 bg-cyan-500/10 px-1 rounded">403</code>.</p>
              <CodeBlock language="text" code={SCOPES} />
            </div>
            <div className="p-4 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl text-[11px] text-amber-300">
              <strong>Security:</strong> Never expose your API keys in client-side code. Use environment variables and server-side proxy requests in production.
            </div>
          </div>
        );

      case "search-api":
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Search API</h1>
              <p className="text-slate-400">Live stock across verified vendors — the same engine behind Finder search — with location-aware ranking. Only verified vendors that have not paused their listings appear.</p>
            </div>
            <div className="space-y-2">
              <EndpointRow method="GET" path="/v1/search" desc="Search inventory across all vendors" />
              <EndpointRow method="GET" path="/v1/search/nearby" desc="Nearest first; latitude and longitude required" />
              <EndpointRow method="GET" path="/v1/search/suggestions" desc="Autocomplete product names (?q=, ?limit=)" />
              <EndpointRow method="POST" path="/v1/search/semantic" desc="AI semantic search — coming soon" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white mb-3">Example Request</h2>
              <CodeBlock language="javascript" code={SEARCH_EXAMPLE} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white mb-3">Response</h2>
              <CodeBlock code={SEARCH_RESPONSE} />
            </div>
          </div>
        );

      case "inventory-api":
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Inventory API</h1>
              <p className="text-slate-400">Push and pull your own inventory. Stock status (in stock, low, out) is derived from quantity and your low-stock threshold — you never set it directly, except to mark an item discontinued.</p>
            </div>
            <div className="space-y-2">
              <EndpointRow method="GET" path="/v1/inventory" desc="List your items (?status=, ?sort=, ?page=)" />
              <EndpointRow method="POST" path="/v1/inventory" desc="Create a new inventory item" />
              <EndpointRow method="GET" path="/v1/inventory/:id" desc="Get a specific item" />
              <EndpointRow method="PATCH" path="/v1/inventory/:id" desc="Update item details or quantity" />
              <EndpointRow method="DELETE" path="/v1/inventory/:id" desc="Remove an item" />
              <EndpointRow method="POST" path="/v1/inventory/sync" desc="Upsert up to 1,000 rows by SKU (alias: /bulk)" />
              <EndpointRow method="GET" path="/v1/inventory/history" desc="Recent sync runs and their results" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white mb-3">Create Item</h2>
              <CodeBlock language="javascript" code={`POST ${API_BASE}/inventory
{
  "name": "Amoxicillin 500mg",
  "sku": "MED-001",
  "quantity": 2400,
  "unit": "pack",
  "price": 1200,
  "currency": "NGN",           // optional — defaults to your Settings preference
  "lowStockThreshold": 200     // optional — defaults to your Settings preference
}`} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white mb-3">Sync Stock</h2>
              <CodeBlock language="javascript" code={`POST ${API_BASE}/inventory/sync
{
  "items": [
    { "sku": "MED-001", "quantity": 1800 },
    { "sku": "MED-002", "quantity": 40, "price": 950, "name": "Paracetamol 1g" }
  ]
}
// Existing SKUs are updated; new SKUs are created only when "name" is present.
// → { "ok": true, "data": { "updated": 1, "created": 1, "failed": 0, "errors": [] } }`} />
            </div>
          </div>
        );

      case "webhooks":
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Webhooks</h1>
              <p className="text-slate-400">Subscribe to Finder platform events and receive real-time HTTP POST notifications to your endpoint.</p>
              <p className="text-[11px] text-amber-400 mt-2">Coming soon — the event catalogue below is the planned contract. Until then, poll <span className="font-mono">/v1/orders</span> and <span className="font-mono">/v1/inventory/history</span>.</p>
            </div>
            <div className="space-y-2">
              {[
                "order.created", "order.updated", "order.cancelled",
                "inventory.updated", "inventory.low_stock", "inventory.out_of_stock",
                "customer.new", "customer.returning",
                "vendor.verified", "vendor.suspended",
              ].map((event) => (
                <div key={event} className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 shrink-0" />
                  <span className="font-mono text-[11px] text-cyan-300 flex-1">{event}</span>
                </div>
              ))}
            </div>
            <div>
              <h2 className="text-base font-semibold text-white mb-3">Webhook Payload</h2>
              <CodeBlock code={`{
  "id": "evt_3K9mXp",
  "type": "inventory.low_stock",
  "created": 1750600920,
  "data": {
    "product_id": "prod_9xK2mP",
    "product_name": "Amoxicillin 500mg",
    "current_quantity": 45,
    "threshold": 200,
    "vendor_id": "v_8492"
  }
}`} />
            </div>
          </div>
        );

      case "sdks":
        return (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white mb-2">SDK Downloads</h1>
            <p className="text-slate-400">Official Finder SDKs are in development. Until they are published, call the REST API directly — it is plain JSON over HTTPS.</p>
            {/* Package names are deliberately not shown: printing an install command for an
                unpublished name invites typosquatting on whoever copies it. */}
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { lang: "JavaScript / TypeScript", pkg: "Not yet published", status: "In Development" },
                { lang: "Python", pkg: "Not yet published", status: "In Development" },
                { lang: "PHP", pkg: "Not yet published", status: "Planned" },
                { lang: "Go", pkg: "Not yet published", status: "Planned" },
              ].map((sdk) => (
                <div key={sdk.lang} className="p-5 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[12px] font-bold text-white">{sdk.lang}</h3>
                    <span className="text-[8px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">{sdk.status}</span>
                  </div>
                  <div className="font-mono text-[10px] text-slate-500 bg-black/20 px-3 py-2 rounded-lg">{sdk.pkg}</div>
                </div>
              ))}
            </div>
          </div>
        );

      case "sandbox":
        return (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white mb-2">Sandbox Environment</h1>
            <p className="text-slate-400">An isolated test environment with pre-populated data and simulated events.</p>
            <div className="p-5 bg-[#06101f] border border-amber-500/20 rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-[11px] font-semibold text-amber-400">Coming Soon</span>
              </div>
              <p className="text-[12px] text-slate-400">
                Until the sandbox launches, create a second vendor account for testing and point your integration at{" "}
                <span className="font-mono text-cyan-300">{API_BASE}</span> with that account&apos;s key. Keys are scoped to one vendor,
                so test calls never touch another business&apos;s data.
              </p>
            </div>
          </div>
        );

      case "changelog":
        return (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white mb-2">Changelog</h1>
            <div className="space-y-5">
              {[
                { version: "v1.0.0", date: "Sep 21, 2026", type: "Release", items: ["REST API live under /api/v1 with scoped API keys", "Search, nearby search and autocomplete suggestions", "Inventory CRUD plus SKU-based bulk sync (1,000 rows per call)", "Orders read access", "Rate limiting: 120 requests per minute per key"] },
                { version: "Roadmap", date: "Planned", type: "Planned", items: ["OAuth 2.0 client credentials", "Outbound webhooks with retries", "Sandbox environment", "Semantic search", "Official SDKs"] },
              ].map((release) => (
                <div key={release.version} className="relative pl-6 border-l border-white/[0.08]">
                  <div className="absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-[#040a15]" />
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-bold text-white font-mono">{release.version}</span>
                    <span className="text-[9px] font-bold uppercase text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full">{release.type}</span>
                    <span className="text-[10px] text-slate-600">{release.date}</span>
                  </div>
                  <ul className="space-y-1">
                    {release.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] text-slate-500">
                        <span className="text-green-400 mt-0.5">+</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        );

      case "status":
        return (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white mb-2">System Status</h1>
            <div className="flex items-center gap-2 px-4 py-3 bg-green-500/[0.07] border border-green-500/20 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[12px] font-semibold text-green-400">All systems operational</span>
            </div>
            <div className="space-y-2">
              {[
                { name: "Search API", uptime: "99.97%", latency: "42ms", status: "operational" },
                { name: "Inventory API", uptime: "99.94%", latency: "58ms", status: "operational" },
                { name: "Vendor API", uptime: "99.99%", latency: "35ms", status: "operational" },
                { name: "Authentication", uptime: "100%", latency: "28ms", status: "operational" },
                { name: "Webhooks", uptime: "99.89%", latency: "—", status: "operational" },
                { name: "Sandbox", uptime: "99.72%", latency: "120ms", status: "degraded" },
              ].map((svc) => (
                <div key={svc.name} className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${svc.status === "operational" ? "bg-green-400" : "bg-amber-400"}`} />
                  <div className="flex-1 text-[12px] font-semibold text-slate-300">{svc.name}</div>
                  <div className="text-[10px] text-slate-500">Latency: <span className="text-slate-400">{svc.latency}</span></div>
                  <div className="text-[10px] text-slate-500">Uptime: <span className="text-slate-400">{svc.uptime}</span></div>
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${svc.status === "operational" ? "text-green-400 bg-green-500/10 border-green-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20"}`}>{svc.status}</span>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-center h-48">
            <p className="text-slate-600 text-sm">Section coming soon.</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#040a15] text-white">
      <Navbar />
      <div className="pt-24 pb-20">
        {/* Hero bar */}
        <div className="border-b border-white/[0.05] bg-[#030810]">
          <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">API v1 · Beta</span>
                </div>
                <h1 className="text-2xl font-bold text-white">Developer Portal</h1>
                <p className="text-slate-500 text-sm mt-1">Build intelligent inventory discovery into your applications</p>
              </div>
              <div className="flex gap-3">
                <Link href="/partners">
                  <Button size="sm" variant="ghost" className="border border-white/[0.07] text-slate-400 hover:text-white gap-2">
                    <Globe className="h-3.5 w-3.5" /> Partner Program
                  </Button>
                </Link>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white gap-2">
                  <KeyRound className="h-3.5 w-3.5" /> Get API Key
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Docs Layout */}
        <div className="container mx-auto px-4 max-w-6xl mt-8">
          <div className="flex gap-8">
            {/* Sidebar */}
            <aside className="w-52 shrink-0 sticky top-24 h-fit space-y-0.5">
              {NAV_ITEMS.map((item) => (
                <button key={item.id} onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all text-left ${activeSection === item.id ? "bg-blue-500/10 text-blue-400 border border-blue-500/[0.18]" : "text-slate-500 hover:text-white hover:bg-white/[0.03]"}`}>
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </button>
              ))}
            </aside>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
