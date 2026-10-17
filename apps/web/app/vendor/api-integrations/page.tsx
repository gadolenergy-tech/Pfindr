"use client";

import { KeyManager, PUBLIC_API_BASE } from "@/components/api-keys/key-manager";
import { VendorSidebar } from "@/components/vendor-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Code2, Webhook, Package, Store, Search, KeyRound, Terminal, FlaskConical,
  ArrowRight, CheckCircle2, Zap, Globe, ShoppingCart, Truck, CreditCard, Copy, ExternalLink
} from "lucide-react";

const SOON = () => (
  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">Coming Soon</span>
);
const LIVE = () => (
  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">Live</span>
);
const BETA = () => (
  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">Beta</span>
);

const CORE_APIS = [
  { icon: Code2, title: "REST API", desc: "Programmatic access to inventory, search and order data. JSON over HTTPS, authenticated with scoped API keys.", badge: <LIVE />, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  { icon: Webhook, title: "Webhooks", desc: "Subscribe to real-time events: new orders, stock changes, customer activity, and inventory updates.", badge: <SOON />, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  { icon: Package, title: "Inventory API", desc: "Push stock levels by SKU and pull your catalogue. Up to 1,000 rows per sync call.", badge: <LIVE />, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  { icon: Store, title: "Vendor API", desc: "Manage vendor profiles, business settings, products, and pricing programmatically.", badge: <SOON />, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  { icon: Search, title: "Search API", desc: "Query live stock across verified vendors from your own applications — the same engine as Finder search.", badge: <LIVE />, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  { icon: KeyRound, title: "Authentication", desc: "Scoped API keys, hashed at rest, revocable instantly, rate-limited per key. OAuth 2.0 and SSO on the roadmap.", badge: <LIVE />, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  { icon: Terminal, title: "SDKs", desc: "Official libraries for JavaScript/TypeScript, Python, and PHP. Community SDKs for other languages.", badge: <SOON />, color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20" },
  { icon: FlaskConical, title: "Sandbox Environment", desc: "Full test environment with realistic mock data. Build and test integrations without affecting production.", badge: <SOON />, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
];

const ERP = [
  { name: "SAP", logo: "SAP", desc: "Enterprise resource planning" },
  { name: "Oracle ERP", logo: "ORC", desc: "Oracle cloud ERP" },
  { name: "Microsoft Dynamics", logo: "MS", desc: "Dynamics 365" },
  { name: "Odoo", logo: "OD", desc: "Open-source ERP" },
  { name: "Zoho Inventory", logo: "ZH", desc: "SME inventory suite" },
  { name: "QuickBooks", logo: "QB", desc: "Accounting & inventory" },
  { name: "ERPNext", logo: "EN", desc: "Open-source ERP" },
];

const POS = [
  { name: "Square POS", logo: "SQ", desc: "Point of sale" },
  { name: "Lightspeed", logo: "LS", desc: "Retail POS" },
  { name: "Shopify POS", logo: "SH", desc: "Retail commerce" },
  { name: "Clover", logo: "CL", desc: "Business POS" },
  { name: "Toast POS", logo: "TP", desc: "Restaurant & retail" },
];

const ECOMMERCE = [
  { name: "Shopify", logo: "SH", desc: "E-commerce platform" },
  { name: "WooCommerce", logo: "WC", desc: "WordPress commerce" },
  { name: "Magento", logo: "MG", desc: "Adobe commerce" },
  { name: "BigCommerce", logo: "BC", desc: "Enterprise commerce" },
];

const LOGISTICS = [
  { name: "DHL", logo: "DHL", desc: "Global logistics" },
  { name: "FedEx", logo: "FDX", desc: "Worldwide delivery" },
  { name: "UPS", logo: "UPS", desc: "Global shipping" },
  { name: "GIG Logistics", logo: "GIG", desc: "Africa logistics" },
  { name: "Local Courier", logo: "LC", desc: "Regional partners" },
];

const PAYMENTS = [
  { name: "Paystack", logo: "PS", desc: "Africa payments" },
  { name: "Flutterwave", logo: "FW", desc: "Pan-Africa fintech" },
  { name: "Stripe", logo: "ST", desc: "Global payments" },
  { name: "Visa", logo: "VI", desc: "Card network" },
  { name: "Mastercard", logo: "MC", desc: "Card network" },
];

function IntegrationCard({ name, logo, desc }: { name: string; logo: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 p-3.5 bg-white/[0.02] border border-white/[0.05] rounded-xl hover:bg-white/[0.04] transition-all group">
      <div className="w-9 h-9 rounded-lg bg-slate-800 border border-white/[0.08] flex items-center justify-center shrink-0">
        <span className="text-[9px] font-bold text-slate-400">{logo}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold text-slate-300 truncate">{name}</div>
        <div className="text-[9px] text-slate-600">{desc}</div>
      </div>
      <span className="text-[8px] font-bold uppercase tracking-wider text-slate-700 bg-white/[0.03] border border-white/[0.05] px-1.5 py-0.5 rounded-full shrink-0">Soon</span>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-white">{title}</h2>
        <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>
      </div>
      {children}
    </div>
  );
}

export default function VendorApiIntegrations() {
  return (
    <div className="min-h-screen flex bg-[#040a15]">
      <VendorSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-[#040a15]/95 backdrop-blur border-b border-white/[0.05] px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">API & Integrations</h1>
            <p className="text-xs text-slate-500 mt-0.5">Connect Finder to your existing tools and infrastructure</p>
          </div>
          <a href="/developers" target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white gap-2 border border-white/[0.06]">
              <ExternalLink className="h-3.5 w-3.5" /> Developer Portal
            </Button>
          </a>
        </div>

        <div className="px-8 py-7 max-w-5xl space-y-10">
          {/* API Keys */}
          <Section title="API Keys" sub={`Authenticate calls to ${PUBLIC_API_BASE} with Authorization: Bearer <key>`}>
            <KeyManager />
          </Section>

          {/* Core APIs */}
          <Section title="Core APIs" sub="Programmatic access to all Finder platform capabilities">
            <div className="grid md:grid-cols-2 gap-4">
              {CORE_APIS.map((api) => (
                <div key={api.title} className={`p-5 rounded-2xl border ${api.border} bg-white/[0.015] hover:bg-white/[0.03] transition-all`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${api.bg} border ${api.border}`}>
                      <api.icon className={`h-4.5 w-4.5 ${api.color}`} style={{ width: "18px", height: "18px" }} />
                    </div>
                    {api.badge}
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">{api.title}</h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed mb-3">{api.desc}</p>
                  <a href="/developers" className={`text-[10px] font-semibold ${api.color} inline-flex items-center gap-1 hover:gap-2 transition-all`}>
                    View Docs <ArrowRight className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </Section>

          {/* Webhook Events Preview */}
          <Section title="Webhook Events" sub="Subscribe to platform events and receive real-time notifications">
            <div className="bg-[#030810] border border-white/[0.06] rounded-2xl p-5 font-mono text-[11px] space-y-2">
              {[
                { event: "order.created", desc: "// New order placed by a buyer" },
                { event: "inventory.updated", desc: "// Stock level changed for a product" },
                { event: "inventory.low_stock", desc: "// Product stock fell below threshold" },
                { event: "customer.new", desc: "// New customer completed registration" },
                { event: "vendor.verified", desc: "// Vendor verification approved by Finder" },
              ].map((e) => (
                <div key={e.event} className="flex items-center gap-4">
                  <span className="text-cyan-400">{e.event}</span>
                  <span className="text-slate-600">{e.desc}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* ERP Integrations */}
          <Section title="ERP Integrations" sub="Connect Finder to your enterprise resource planning system">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {ERP.map((e) => <IntegrationCard key={e.name} {...e} />)}
            </div>
          </Section>

          {/* POS + E-commerce side by side */}
          <div className="grid lg:grid-cols-2 gap-8">
            <Section title="POS Integrations" sub="Sync Finder with your point-of-sale system">
              <div className="space-y-2">{POS.map((e) => <IntegrationCard key={e.name} {...e} />)}</div>
            </Section>
            <Section title="E-commerce Integrations" sub="Connect your online storefront to Finder">
              <div className="space-y-2">{ECOMMERCE.map((e) => <IntegrationCard key={e.name} {...e} />)}</div>
            </Section>
          </div>

          {/* Logistics + Payments side by side */}
          <div className="grid lg:grid-cols-2 gap-8">
            <Section title="Logistics Partners" sub="Route deliveries through trusted partners after discovery">
              <div className="space-y-2">{LOGISTICS.map((e) => <IntegrationCard key={e.name} {...e} />)}</div>
            </Section>
            <Section title="Payment Partners" sub="Secure checkout infrastructure for future transactions">
              <div className="space-y-2">{PAYMENTS.map((e) => <IntegrationCard key={e.name} {...e} />)}</div>
            </Section>
          </div>

          {/* Enterprise Notice */}
          <div className="flex items-start gap-4 p-5 bg-white/[0.015] border border-white/[0.06] rounded-2xl">
            <Zap className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-[12px] font-semibold text-slate-300 mb-1">Enterprise Integration Support</div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Need a custom integration with your existing ERP, warehouse management system, or internal tools?
                Our enterprise team provides direct integration support, SLA-backed uptime, and dedicated implementation assistance.
              </p>
              <a href="/partners" className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 mt-2 transition-colors">
                Contact Enterprise Team <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
