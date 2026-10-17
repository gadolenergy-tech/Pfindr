"use client";

import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Search, Store, ArrowRight, CheckCircle2 } from "lucide-react";

export default function SignupRole() {
  return (
    <div className="min-h-screen bg-[#040a15] text-white flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4 pt-24 pb-16">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-5">
              Get Started Free
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">Join Finder Network</h1>
            <p className="text-slate-400 text-lg font-light">Choose how you want to use Finder.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* User Account */}
            <Link href="/signup/user">
              <div className="group relative cursor-pointer rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 hover:bg-white/[0.05] hover:border-blue-500/30 transition-all duration-200"
                style={{ boxShadow: "none" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 40px -12px rgba(59,130,246,0.25), inset 0 0 0 1px rgba(59,130,246,0.15)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 group-hover:bg-blue-500/15 transition-colors">
                  <Search className="h-7 w-7 text-blue-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-3">User Account</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Find products, services, pharmacies, blood banks, food, beverages, tools, and trusted vendors instantly.
                </p>
                <div className="space-y-2 mb-7">
                  {["Real-time inventory search", "Nearest verified vendors", "Live stock & pricing", "Free to use"].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-[12px] text-slate-500">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-400/70 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-400 group-hover:gap-3 transition-all">
                  Continue as User <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Link>

            {/* Vendor Account */}
            <Link href="/vendor/signup">
              <div className="group relative cursor-pointer rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 hover:bg-white/[0.05] hover:border-emerald-500/30 transition-all duration-200"
                style={{ boxShadow: "none" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 40px -12px rgba(52,211,153,0.2), inset 0 0 0 1px rgba(52,211,153,0.12)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 group-hover:bg-emerald-500/15 transition-colors">
                  <Store className="h-7 w-7 text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-3">Vendor Account</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  List inventory, receive orders, gain customers, and grow your business through Finder Network.
                </p>
                <div className="space-y-2 mb-7">
                  {["Live inventory sync", "AI-powered discovery", "Verified vendor badge", "Orders & analytics"].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-[12px] text-slate-500">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/70 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400 group-hover:gap-3 transition-all">
                  Continue as Vendor <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Link>
          </div>

          <p className="text-center text-sm text-slate-600 mt-8">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-400 hover:text-blue-300 transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
