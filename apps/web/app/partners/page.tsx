"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, ArrowRight, Database, Truck, CreditCard, Store, Warehouse, Code2, Settings, Building2, HeartPulse, Globe } from "lucide-react";
import type { PartnerInquiryInput } from "@finder/shared";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const PARTNER_TYPES = [
  { icon: Database, title: "ERP Partners", desc: "SAP, Oracle, Microsoft Dynamics, Odoo, Zoho, QuickBooks, ERPNext — connect your ERP to real-time inventory on Finder.", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  { icon: Truck, title: "Logistics Partners", desc: "DHL, FedEx, UPS, GIG Logistics, and regional couriers — enable seamless last-mile delivery after product discovery.", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  { icon: CreditCard, title: "Payment Partners", desc: "Paystack, Flutterwave, Stripe, Visa, Mastercard — power secure transactions within the Finder discovery network.", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  { icon: Store, title: "POS Partners", desc: "Square, Lightspeed, Shopify POS, Clover, Toast — sync point-of-sale inventory directly to Finder's live network.", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  { icon: Settings, title: "Inventory Software", desc: "Inventory management platforms seeking to expose their data to Finder's discovery network and buyer base.", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  { icon: Warehouse, title: "Warehouse Management", desc: "WMS providers who want to sync warehouse inventory to Finder for enterprise and B2B procurement discovery.", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  { icon: Code2, title: "Software Developers", desc: "Individual developers and agencies building applications that leverage Finder's APIs for inventory discovery.", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  { icon: Globe, title: "System Integrators", desc: "Enterprise integration consultants who deploy Finder alongside existing client infrastructure.", color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
  { icon: Building2, title: "Government Agencies", desc: "Public procurement bodies, emergency services, and regulatory agencies requiring real-time supply chain visibility.", color: "text-slate-300", bg: "bg-slate-500/10", border: "border-slate-500/20" },
  { icon: HeartPulse, title: "Healthcare Organisations", desc: "Hospitals, pharmacies, blood banks, and healthcare networks ensuring critical supply availability in real time.", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
];

const BENEFITS = [
  "Access to Finder's growing vendor and buyer network",
  "Co-marketing opportunities and platform visibility",
  "Technical integration support and dedicated partner manager",
  "Early access to new Finder APIs and platform features",
  "Revenue sharing and referral commission programs",
  "Verified partner badge and directory listing",
];

const PARTNER_TYPES_SELECT = PARTNER_TYPES.map((p) => p.title);

/** UI category → the six values the API's PartnershipType enum accepts. */
const PARTNERSHIP_TYPE: Record<string, PartnerInquiryInput["partnershipType"]> = {
  "ERP Partners": "TECHNOLOGY",
  "Logistics Partners": "LOGISTICS",
  "Payment Partners": "TECHNOLOGY",
  "POS Partners": "TECHNOLOGY",
  "Inventory Software": "TECHNOLOGY",
  "Warehouse Management": "LOGISTICS",
  "Software Developers": "TECHNOLOGY",
  "System Integrators": "TECHNOLOGY",
  "Government Agencies": "OTHER",
  "Healthcare Organisations": "OTHER",
};

export default function PartnersPage() {
  const [form, setForm] = useState({ org: "", name: "", email: "", type: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/partners/inquiries", {
        companyName: form.org,
        contactName: form.name,
        contactEmail: form.email,
        partnershipType: PARTNERSHIP_TYPE[form.type] ?? "OTHER",
        message: form.message,
      });
      setSubmitted(true);
    } catch (err) {
      toast({
        title: "Could not submit application",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#040a15] text-white">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/20 via-transparent to-transparent pointer-events-none" />
        <div className="container mx-auto max-w-4xl text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mb-6">
            Partner Program
          </div>
          <h1 className="text-5xl font-bold mb-5 leading-tight">
            Build the Future of<br /><span className="text-indigo-400">Inventory Discovery</span>
          </h1>
          <p className="text-xl text-slate-400 font-light max-w-2xl mx-auto mb-10 leading-relaxed">
            Partner with Finder Network to integrate your platform, expand your market reach, and become part of the world's most intelligent real-time inventory discovery infrastructure.
          </p>
          <Button size="lg" className="h-14 px-8 text-base bg-indigo-600 hover:bg-indigo-500 text-white gap-2"
            onClick={() => document.getElementById("apply")?.scrollIntoView({ behavior: "smooth" })}>
            Apply to Partner <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Partner Types */}
      <section className="py-20 px-4 border-t border-white/[0.04]">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-3">Partnership Categories</h2>
            <p className="text-slate-500 font-light max-w-xl mx-auto">Finder partners with organisations at every layer of the supply chain and digital infrastructure stack.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {PARTNER_TYPES.map((p) => (
              <div key={p.title} className={`p-6 rounded-2xl border ${p.border} bg-white/[0.015] hover:bg-white/[0.03] transition-all`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${p.bg} border ${p.border}`}>
                  <p.icon className={`h-5 w-5 ${p.color}`} />
                </div>
                <h3 className="text-sm font-bold text-white mb-2">{p.title}</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-4 bg-[#030810] border-t border-white/[0.04]">
        <div className="container mx-auto max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-indigo-400 font-semibold mb-4">Why Partner with Finder</div>
              <h2 className="text-3xl font-bold text-white mb-5">Everything you need to grow with us</h2>
              <p className="text-slate-400 font-light mb-8 leading-relaxed">
                Finder is building the global infrastructure layer for physical inventory discovery. Partners gain early access to distribution, APIs, and a rapidly growing network of vendors and buyers.
              </p>
              <div className="space-y-3">
                {BENEFITS.map((b) => (
                  <div key={b} className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span className="text-[12px] text-slate-400">{b}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: "Vendor Partners", value: "500+", sub: "Across 12 industries" },
                { label: "Daily Searches", value: "84K+", sub: "Real-time inventory queries" },
                { label: "Countries", value: "8", sub: "African + international markets" },
              ].map((stat) => (
                <div key={stat.label} className="p-5 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
                  <div className="text-3xl font-bold text-indigo-400 tabular-nums">{stat.value}</div>
                  <div className="text-[12px] font-semibold text-white mt-1">{stat.label}</div>
                  <div className="text-[10px] text-slate-600">{stat.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Application Form */}
      <section id="apply" className="py-20 px-4 border-t border-white/[0.04]">
        <div className="container mx-auto max-w-2xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">Apply for Partnership</h2>
            <p className="text-slate-500 font-light">Tell us about your organisation and how you'd like to partner with Finder Network.</p>
          </div>

          {submitted ? (
            <div className="text-center py-16 bg-white/[0.02] border border-white/[0.06] rounded-3xl">
              <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Application Received</h3>
              <p className="text-slate-500 text-sm">Our partnerships team will review your application and respond within 2–3 business days.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white/[0.02] border border-white/[0.06] rounded-3xl p-8 space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1.5 font-semibold">Organisation Name *</label>
                  <Input required value={form.org} onChange={(e) => setForm((f) => ({ ...f, org: e.target.value }))}
                    placeholder="e.g. Acme Systems Ltd" className="bg-white/[0.03] border-white/[0.07] text-slate-200 h-10 placeholder:text-slate-600" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1.5 font-semibold">Contact Name *</label>
                  <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Your full name" className="bg-white/[0.03] border-white/[0.07] text-slate-200 h-10 placeholder:text-slate-600" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1.5 font-semibold">Business Email *</label>
                <Input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@yourcompany.com" className="bg-white/[0.03] border-white/[0.07] text-slate-200 h-10 placeholder:text-slate-600" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1.5 font-semibold">Partnership Type *</label>
                <select required value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-slate-300 outline-none focus:border-indigo-500/40 transition-all appearance-none">
                  <option value="" disabled>Select a category…</option>
                  {PARTNER_TYPES_SELECT.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1.5 font-semibold">How would you like to integrate with Finder? *</label>
                <textarea required value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  rows={4} placeholder="Briefly describe your organisation, your platform, and the integration opportunity you have in mind…"
                  className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/40 transition-all resize-none placeholder:text-slate-600" />
              </div>
              <Button type="submit" disabled={submitting} className="w-full h-12 text-base bg-indigo-600 hover:bg-indigo-500 text-white gap-2">
                {submitting ? "Submitting…" : "Submit Partnership Application"} <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-center text-[10px] text-slate-600">We respond to all applications within 2–3 business days.</p>
            </form>
          )}

          <div className="mt-8 text-center">
            <p className="text-[12px] text-slate-600">
              Technical questions?{" "}
              <Link href="/developers" className="text-indigo-400 hover:text-indigo-300 transition-colors">Visit the Developer Portal</Link>
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
