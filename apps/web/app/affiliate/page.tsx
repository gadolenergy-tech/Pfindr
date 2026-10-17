"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import Link from "next/link";
import { UserPlus, Share2, Users, DollarSign, TrendingUp, BarChart3, Globe, ArrowRight, CheckCircle2, Zap, Shield, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  { step: "01", icon: UserPlus, title: "Join", desc: "Sign up as a Finder Affiliate Partner in under 2 minutes. Free to join, no approval wait." },
  { step: "02", icon: Share2, title: "Share", desc: "Get your unique referral link and marketing assets. Share on social, email, or your website." },
  { step: "03", icon: Users, title: "Refer", desc: "Refer vendors and users to Finder Network. Every verified signup counts toward your earnings." },
  { step: "04", icon: DollarSign, title: "Earn", desc: "Earn recurring commissions on every active vendor you refer, plus bonuses for top performers." },
];

const BENEFITS = [
  { icon: TrendingUp, title: "Recurring Commissions", desc: "Earn a percentage of every vendor subscription fee — month after month, not just once.", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  { icon: Zap, title: "Performance Bonuses", desc: "Hit monthly referral targets and unlock bonus tiers with accelerated commission rates.", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  { icon: Globe, title: "Marketing Assets", desc: "Ready-made banners, copy, landing pages, and social content provided free to all affiliates.", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  { icon: BarChart3, title: "Real-Time Dashboard", desc: "Track clicks, conversions, earnings, and payouts from your affiliate dashboard in real time.", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  { icon: RefreshCw, title: "Referral Tracking", desc: "Every click from your link is tracked with 90-day cookie attribution — you get credit.", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  { icon: Shield, title: "Transparent Payments", desc: "Monthly payouts via bank transfer, Flutterwave, or USDT. No hidden deductions.", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
];

const TIERS = [
  { name: "Starter", refs: "1–5 referrals", rate: "8%", bonus: "—", color: "text-slate-400", border: "border-white/[0.08]" },
  { name: "Growth", refs: "6–20 referrals", rate: "12%", bonus: "₦50,000/mo bonus", color: "text-blue-400", border: "border-blue-500/20", highlight: true },
  { name: "Elite", refs: "21–50 referrals", rate: "18%", bonus: "₦200,000/mo bonus", color: "text-amber-400", border: "border-amber-500/20" },
  { name: "Enterprise", refs: "50+ referrals", rate: "Custom", bonus: "Custom", color: "text-cyan-400", border: "border-cyan-500/20" },
];

export default function AffiliatePage() {
  return (
    <div className="min-h-screen bg-[#040a15] text-white">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/20 via-transparent to-transparent pointer-events-none" />
        <div className="container mx-auto max-w-4xl text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-6">
            Affiliate Program
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-5 leading-tight">
            Earn by Growing<br /><span className="text-blue-400">Finder Network</span>
          </h1>
          <p className="text-xl text-slate-400 font-light max-w-2xl mx-auto mb-10 leading-relaxed">
            Help businesses and consumers discover Finder while earning recurring commissions. Join thousands of partners growing the world's most intelligent inventory network.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/affiliate/join">
              <Button size="lg" className="h-14 px-8 text-base bg-blue-600 hover:bg-blue-500 text-white gap-2">
                Join as Affiliate <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/affiliate/join">
              <Button size="lg" variant="ghost" className="h-14 px-8 text-base text-slate-400 hover:text-white border border-white/[0.08] hover:bg-white/[0.04]">
                View Dashboard
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8">
            {["Free to join", "No approval wait", "90-day cookie", "Monthly payouts"].map((item) => (
              <div key={item} className="flex items-center gap-2 text-[11px] text-slate-500">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400/60" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 border-t border-white/[0.04]">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-3">How It Works</h2>
            <p className="text-slate-500 font-light">Four simple steps to start earning with Finder.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <div key={i} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-px bg-white/[0.05] z-0" style={{ width: "calc(100% - 3rem)", left: "3rem" }} />
                )}
                <div className="relative z-10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center mx-auto mb-4">
                    <step.icon className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="text-[10px] font-bold text-blue-400/60 uppercase tracking-widest mb-1">{step.step}</div>
                  <h3 className="text-base font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-[12px] text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-4 bg-[#030810] border-t border-white/[0.04]">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-3">Affiliate Benefits</h2>
            <p className="text-slate-500 font-light">Everything you need to succeed as a Finder partner.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {BENEFITS.map((b) => (
              <div key={b.title} className={`p-6 rounded-2xl border ${b.border} bg-white/[0.015] hover:bg-white/[0.03] transition-all`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${b.bg} border ${b.border}`}>
                  <b.icon className={`h-5 w-5 ${b.color}`} />
                </div>
                <h3 className="text-sm font-bold text-white mb-2">{b.title}</h3>
                <p className="text-[12px] text-slate-500 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Commission Tiers */}
      <section className="py-20 px-4 border-t border-white/[0.04]">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-3">Commission Structure</h2>
            <p className="text-slate-500 font-light">The more vendors you refer, the more you earn — automatically.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {TIERS.map((tier) => (
              <div key={tier.name} className={`p-5 rounded-2xl border ${tier.border} ${tier.highlight ? "bg-blue-500/[0.06]" : "bg-white/[0.015]"} text-center`}>
                {tier.highlight && <div className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-2">Most Popular</div>}
                <h3 className={`text-base font-bold mb-1 ${tier.color}`}>{tier.name}</h3>
                <div className={`text-3xl font-bold tabular-nums mb-1 ${tier.color}`}>{tier.rate}</div>
                <div className="text-[10px] text-slate-600 mb-3">per vendor/month</div>
                <div className="text-[10px] text-slate-500 font-medium bg-white/[0.03] border border-white/[0.05] rounded-lg px-3 py-2 mb-2">{tier.refs}</div>
                <div className="text-[10px] text-slate-600">{tier.bonus}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-br from-blue-950/20 via-background to-background border-t border-white/[0.04]">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Start Earning?</h2>
          <p className="text-slate-400 mb-8 font-light">Join Finder's affiliate program today and start building recurring income.</p>
          <Link href="/affiliate/join">
            <Button size="lg" className="h-14 px-10 text-base bg-blue-600 hover:bg-blue-500 text-white gap-2">
              Join Affiliate Program <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <p className="text-[11px] text-slate-600 mt-4">Free · No approval wait · Monthly payouts</p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
