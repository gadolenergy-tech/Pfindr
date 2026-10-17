"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { SearchModal } from "@/components/search-modal";
import { AINetworkBg } from "@/components/ai-network-bg";
import { LiveTicker } from "@/components/live-ticker";
import { useAuth } from "@/lib/auth-context";
const worldBg = "/images/world-grid.png";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Search, Zap, Shield, MapPin, CheckCircle2, ArrowRight, Building2, Activity, Star, Box, Phone, Pill, Utensils, Wrench, Factory, ShoppingBag, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { motion, useInView, AnimatePresence } from "framer-motion";

function FloatingParticles() {
  const particles = [
    { top: "10%", left: "20%", size: 4, delay: 0, duration: 3 },
    { top: "30%", left: "80%", size: 3, delay: 1, duration: 4 },
    { top: "60%", left: "10%", size: 5, delay: 0.5, duration: 3.5 },
    { top: "80%", left: "70%", size: 4, delay: 2, duration: 4 },
    { top: "40%", left: "40%", size: 3, delay: 1.5, duration: 3 },
    { top: "20%", left: "60%", size: 6, delay: 0.2, duration: 4.5 },
    { top: "70%", left: "30%", size: 4, delay: 0.8, duration: 3.2 },
    { top: "50%", left: "90%", size: 3, delay: 2.5, duration: 5 },
    { top: "90%", left: "50%", size: 5, delay: 1.2, duration: 3.8 },
    { top: "15%", left: "95%", size: 4, delay: 0.4, duration: 4.1 },
    { top: "85%", left: "15%", size: 3, delay: 1.8, duration: 3.4 },
    { top: "45%", left: "5%", size: 5, delay: 0.7, duration: 4.2 },
  ];

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-blue-400"
          style={{ top: p.top, left: p.left, width: p.size, height: p.size }}
          animate={{ y: [0, -20, 0], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 2000;
    const step = (target / duration) * 16;
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { 
        setCount(target); 
        clearInterval(timer); 
      }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, target]);
  
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

const CATS = [
  { icon: Pill, label: "Healthcare", desc: "Pharmacies & Blood Banks", color: "text-rose-400", bg: "bg-rose-500/10", glow: "rgba(244,63,94,0.3)" },
  { icon: Utensils, label: "Food & Beverage", desc: "Fresh & Packaged Goods", color: "text-orange-400", bg: "bg-orange-500/10", glow: "rgba(249,115,22,0.3)" },
  { icon: Wrench, label: "Industrial", desc: "Tools & Equipment", color: "text-slate-300", bg: "bg-slate-500/10", glow: "rgba(148,163,184,0.3)" },
  { icon: Factory, label: "Oil & Gas", desc: "Drilling & Maintenance", color: "text-amber-400", bg: "bg-amber-500/10", glow: "rgba(245,158,11,0.3)" },
  { icon: Shield, label: "Emergency", desc: "Critical Supply Chain", color: "text-cyan-400", bg: "bg-cyan-500/10", glow: "rgba(34,211,238,0.3)" },
  { icon: ShoppingBag, label: "Everyday", desc: "Consumer Products", color: "text-blue-400", bg: "bg-blue-500/10", glow: "rgba(59,130,246,0.3)" },
];

export default function Home() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [hoveredCat, setHoveredCat] = useState<number | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  /** Search requires a signed-in account; anonymous visitors go to login first. */
  function openSearch() {
    if (!user) {
      router.push("/login?next=/");
      return;
    }
    setSearchOpen(true);
  }

  // An already-registered vendor should land on their own dashboard, not
  // restart the vendor onboarding flow and appear to lose their products.
  const vendorCtaHref = user?.role === "VENDOR" ? "/vendor/dashboard" : "/vendor/signup";

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 5);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const [heroProgress, setHeroProgress] = useState(0);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 2;
        if (progress >= 94) {
          setHeroProgress(94);
          clearInterval(interval);
          setTimeout(() => setShowResults(true), 400);
        } else {
          setHeroProgress(progress);
        }
      }, 30);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <Navbar />
      
      {/* SECTION 1 — HERO */}
      <section className="relative min-h-[100vh] flex items-center pt-24 pb-12 overflow-hidden">
        {/* Background Layers */}
        <div className="absolute inset-0 z-0">
          <img 
            src={worldBg} 
            alt="World Map Connections" 
            className="w-full h-full object-cover object-center opacity-60" 
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/40 to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
          <div 
            className="absolute inset-0 opacity-[0.03] animate-grid-drift" 
            style={{ 
              backgroundImage: 'linear-gradient(rgba(99,179,237,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,179,237,1) 1px, transparent 1px)', 
              backgroundSize: '60px 60px' 
            }} 
          />
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-600/[0.08] rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-500/[0.05] rounded-full blur-[80px]" />
          <FloatingParticles />
          <AINetworkBg />
        </div>

        <div className="container relative z-10 mx-auto px-4 grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
            }}
            className="space-y-8 max-w-2xl pt-10"
          >
            <motion.div 
              variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
              className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary backdrop-blur-sm shadow-[0_0_8px_rgba(74,222,128,0.6)]"
            >
              <span className="flex h-2 w-2 rounded-full bg-green-500 mr-2 shadow-[0_0_10px_rgba(34,197,94,0.8)] animate-pulse"></span>
              AI-Powered Real-Time Discovery
            </motion.div>
            
            <motion.h1 
              variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
              className="text-6xl lg:text-7xl xl:text-8xl font-extrabold tracking-[-0.02em] text-white leading-[1.1]"
            >
              Find What's Available.<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-200">Instantly.</span>
            </motion.h1>
            
            <motion.p 
              variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
              className="text-xl text-slate-400 leading-relaxed max-w-xl font-light line-clamp-2"
            >
              The intelligent network that connects you to verified vendors with live inventory, real-time stock, and instant pricing.
            </motion.p>

            <motion.div 
              variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
              className="flex flex-col sm:flex-row gap-4 pt-2"
            >
              <Button
                data-testid="btn-hero-search"
                size="lg"
                onClick={openSearch}
                className="h-14 px-8 text-lg font-semibold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-[0_0_30px_-5px_rgba(59,130,246,0.6)] transition-all w-full sm:w-auto cursor-pointer"
              >
                Start Searching <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Link href="/how-it-works">
                <Button data-testid="btn-hero-demo" size="lg" variant="outline" className="h-14 px-8 text-lg font-medium border-white/15 hover:bg-white/5 backdrop-blur-sm w-full sm:w-auto">
                  Watch Demo
                </Button>
              </Link>
            </motion.div>

            <motion.div 
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
              className="pt-6 text-sm text-slate-500"
            >
              <span className="inline-flex items-center">
                50K+ Vendors <span className="mx-3 text-white/20">/</span> 12M+ Products <span className="mx-3 text-white/20">/</span> &lt;2s Response
              </span>
            </motion.div>
          </motion.div>

          {/* Right Content - Dashboard Preview */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: [0, -10, 0] }}
            transition={{ 
              opacity: { duration: 0.8, delay: 0.4 },
              y: { duration: 6, repeat: Infinity, ease: "easeInOut" }
            }}
            className="relative lg:ml-auto w-full max-w-[500px]"
          >
            <div className="absolute -inset-px bg-gradient-to-br from-blue-500/30 via-cyan-500/10 to-transparent rounded-[2rem] blur-xl" />
            <div className="absolute -inset-2 bg-blue-500/[0.05] rounded-[2.5rem] blur-2xl" />

            <div className="relative bg-[#060d1f]/90 backdrop-blur-2xl border border-white/[0.08] rounded-[1.75rem] overflow-hidden shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)] max-h-[500px] overflow-y-auto">
              
              {/* Header / Window Chrome */}
              <div className="px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.02] flex justify-between items-center relative">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 bg-white/[0.05] rounded-md h-6 flex items-center px-3 gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[11px] text-slate-500 font-mono">finder.ai / discovery</span>
                </div>
                {/* LIVE Badge */}
                <div className="flex items-center gap-1.5 bg-red-500/10 text-red-400 text-[10px] font-bold tracking-widest border border-red-500/20 rounded px-1.5 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
                </div>
              </div>

              {/* Search Bar Row */}
              <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
                <div className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <Search className="h-4 w-4 text-slate-500" />
                  <div className="text-sm font-mono text-slate-300 flex items-center">
                    amoxicillin 500mg
                    <motion.span 
                      animate={{ opacity: [1, 0, 1] }} 
                      transition={{ duration: 1, repeat: Infinity }}
                      className="ml-1 inline-block w-1.5 h-4 bg-primary"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <MapPin className="h-3 w-3" /> Lagos, NG
                </div>
              </div>

              {/* AI Processing Row */}
              <div className="px-5 py-3 bg-blue-500/[0.04] border-b border-blue-500/10 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-blue-400 flex items-center gap-1.5">
                    <Zap className="h-3 w-3" /> AI Network Processing
                  </span>
                  <span className="font-mono text-blue-300 text-[11px]">{heroProgress}%</span>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                    style={{ width: `${heroProgress}%` }}
                  />
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-3">
                {!showResults && (
                  <div className="text-center py-6 text-slate-600 text-sm">
                    Scanning vendor network...
                  </div>
                )}
                <AnimatePresence>
                  {showResults && [
                    { name: "PharmaCare Plus", dist: "2.1km", stock: 847, price: "₦1,200/pk", delay: 0 },
                    { name: "MedHub Central", dist: "3.4km", stock: 234, price: "₦1,150/pk", delay: 0.25 },
                    { name: "QuickMeds", dist: "5.2km", stock: 1200, price: "₦1,300/pk", delay: 0.5 }
                  ].map((vendor, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: vendor.delay, duration: 0.4 }}
                      className="bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/10 rounded-xl p-3.5 flex justify-between items-center transition-colors"
                    >
                      <div className="flex gap-3 items-center">
                        <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-slate-200 font-medium">{vendor.name}</span>
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            <span className="text-green-400">{vendor.stock} in stock</span> • {vendor.dist}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-white">{vendor.price}</div>
                        <div className="text-[10px] text-green-400 mt-0.5">In Stock</div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {showResults && (
                  <div className="pt-2 text-center text-[11px] text-slate-600">
                    3 of 24 vendors shown • <span className="text-blue-400 cursor-pointer hover:underline">View all results</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 2 — ANIMATED METRICS */}
      <section className="py-24 relative bg-[#040a15]">
        <div className="container mx-auto px-4 relative z-10">
          <h2 className="text-[11px] uppercase tracking-[0.2em] text-slate-500 text-center mb-12">NETWORK INTELLIGENCE AT SCALE</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6">
            {[
              { num: 50000, suffix: "+", label: "Active Vendors", animated: true },
              { num: 12, suffix: "M+", label: "Products Indexed", animated: true },
              { num: 140, suffix: "+", label: "Cities Connected", animated: true },
              { text: "< 2s", label: "Query Response", animated: false },
              { text: "2.8M+", label: "Inventory Syncs", animated: false },
              { text: "99.7%", label: "Platform Uptime", animated: false }
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white/[0.02] border border-white/[0.05] rounded-2xl px-6 py-7 text-center relative overflow-hidden group hover:bg-white/[0.03] hover:border-white/[0.08] transition-all duration-300"
              >
                <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-blue-500/50 animate-pulse" />
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/25 to-transparent" />
                <div className="flex items-baseline justify-center gap-0.5 mb-1">
                  <span className="text-[2rem] font-bold text-white leading-none tabular-nums tracking-tight" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {stat.animated ? <AnimatedCounter target={stat.num as number} suffix="" /> : stat.text}
                  </span>
                  {stat.animated && stat.suffix && (
                    <span className="text-xl font-bold text-white/70 leading-none">{stat.suffix}</span>
                  )}
                </div>
                <div className="h-px w-6 bg-white/[0.08] mx-auto my-3" />
                <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      <LiveTicker />

      {/* SECTION 3 — HOW FINDER WORKS */}
      <section className="py-32 relative bg-[#040a15] overflow-hidden border-t border-white/5">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">Intelligence in Motion</h2>
            <p className="text-xl text-slate-400 font-light">From intent to fulfillment — our AI agents route every search through a live vendor graph in real time.</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
            {/* Timeline */}
            <div className="space-y-4">
              {[
                { icon: Search, title: "Search", desc: "User types natural language query" },
                { icon: Activity, title: "AI Analyzes", desc: "System processes context and location" },
                { icon: MapPin, title: "Vendors Found", desc: "Nearest verified suppliers surface" },
                { icon: Box, title: "Live Stock", desc: "Real-time inventory data loads" },
                { icon: Phone, title: "Connect", desc: "One-tap vendor contact" }
              ].map((step, i) => {
                const isActive = activeStep === i;
                return (
                  <div 
                    key={i} 
                    className={`relative flex gap-6 py-4 rounded-xl transition-all duration-500 cursor-pointer ${isActive ? 'border-l-2 border-l-blue-500 pl-4 bg-transparent' : 'border-l-2 border-l-transparent pl-4'}`} 
                    onClick={() => setActiveStep(i)}
                  >
                    <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500 ${isActive ? 'bg-primary border-primary text-white shadow-[0_0_20px_rgba(59,130,246,0.6)] scale-110' : 'bg-background border-white/20 text-slate-500'}`}>
                      <step.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className={`text-xl font-bold transition-colors ${isActive ? 'text-white' : 'text-slate-400'}`}>{step.title}</h4>
                      <p className={`mt-1 transition-colors ${isActive ? 'text-slate-300' : 'text-slate-600'}`}>{step.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Visualization Panel */}
            <div className="relative aspect-square md:aspect-[4/3] w-full max-w-lg mx-auto">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-[2.5rem] blur-3xl opacity-30" />
              <div className="absolute inset-0 bg-[#040a15]/90 backdrop-blur-2xl border border-white/[0.06] rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center p-8">
                <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
                
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.4 }}
                    className="w-full h-full flex flex-col items-center justify-center text-center gap-6 relative z-10"
                  >
                    {activeStep === 0 && (
                      <div className="w-full max-w-sm space-y-2">
                        <div className="bg-white/5 border border-white/10 rounded-xl h-14 flex items-center px-4 shadow-inner">
                          <Search className="text-slate-400 w-5 h-5 mr-3" />
                          <div className="text-slate-200 text-sm flex items-center">
                            find construction equipment
                            <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} className="ml-1 inline-block w-1.5 h-4 bg-blue-500" />
                          </div>
                        </div>
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white/5 border border-white/10 rounded-lg p-2 text-left space-y-1">
                          <div className="px-3 py-2 hover:bg-white/5 rounded cursor-pointer text-sm text-slate-300">Heavy machinery rentals</div>
                          <div className="px-3 py-2 hover:bg-white/5 rounded cursor-pointer text-sm text-slate-300">Power tools wholesale</div>
                        </motion.div>
                      </div>
                    )}
                    {activeStep === 1 && (
                      <div className="relative w-40 h-40 flex items-center justify-center">
                        <div className="absolute inset-0 border border-blue-500/20 rounded-full animate-[spin_8s_linear_infinite]" />
                        <div className="absolute inset-3 border-t-2 border-blue-400/40 rounded-full animate-[spin_6s_linear_infinite_reverse]" />
                        <div className="absolute inset-6 border-b-2 border-cyan-400/60 rounded-full animate-[spin_4s_linear_infinite]" />
                        <div className="absolute inset-10 border-r-2 border-blue-300/80 rounded-full animate-[spin_3s_linear_infinite_reverse]" />
                        <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse shadow-[0_0_20px_rgba(59,130,246,0.8)]" />
                      </div>
                    )}
                    {activeStep === 2 && (
                      <div className="w-full space-y-4">
                        {[1, 2, 3].map((i) => (
                          <motion.div 
                            key={i} 
                            initial={{ x: 50, opacity: 0 }} 
                            animate={{ x: 0, opacity: 1 }} 
                            transition={{ delay: i * 0.15 }}
                            className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4"
                          >
                            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                              <MapPin className="w-4 h-4 text-blue-400" />
                            </div>
                            <div className="flex-1 text-left space-y-1.5">
                              <div className="h-2.5 w-1/2 bg-slate-300 rounded" />
                              <div className="h-2 w-1/4 bg-slate-500 rounded" />
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                    {activeStep === 3 && (
                      <div className="w-full bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                        <div className="bg-black/40 px-4 py-3 border-b border-white/5 flex justify-between text-xs font-semibold text-slate-400">
                          <span>ITEM</span>
                          <span>STOCK</span>
                        </div>
                        <div className="p-4 space-y-4">
                          {[1,2,3].map((i) => (
                            <div key={i} className="flex justify-between items-center border-b border-white/5 pb-3 last:border-0 last:pb-0">
                              <div className="w-1/3 h-2.5 bg-slate-300 rounded" />
                              <div className="text-green-400 font-mono text-sm font-bold">1,24{i}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {activeStep === 4 && (
                      <div className="w-full max-w-xs text-center space-y-6">
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/30 shadow-[0_0_40px_rgba(34,197,94,0.2)]">
                          <CheckCircle2 className="w-10 h-10 text-green-400" />
                        </motion.div>
                        <div className="text-xl font-bold text-white">Connected</div>
                        <Button className="w-full h-12 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg pointer-events-none">
                          Send Message
                        </Button>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 — CATEGORIES */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <section className="py-24 relative bg-[#040a15]">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">Built for Every Sector</h2>
            <p className="text-xl text-slate-400 font-light">One platform. Every critical industry. Real-time inventory intelligence that never sleeps.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CATS.map((cat, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="cursor-pointer group h-full"
                onMouseEnter={() => setHoveredCat(i)}
                onMouseLeave={() => setHoveredCat(null)}
                data-testid={`category-${cat.label.toLowerCase().replace(/s|&/g, "-")}`}
              >
                <div
                  className="h-full bg-white/[0.02] border border-white/[0.05] rounded-3xl overflow-hidden transition-all duration-300 relative"
                  style={hoveredCat === i ? {
                    borderColor: `${cat.glow.replace("0.3", "0.4")}`,
                    backgroundColor: "rgba(255,255,255,0.03)",
                    boxShadow: `0 0 40px -10px ${cat.glow}`
                  } : {}}
                >
                  <div className="p-10 flex flex-col h-full">
                    <div
                      className={`relative h-14 w-14 rounded-2xl flex items-center justify-center ${cat.bg} mb-6 transition-all duration-300`}
                      style={hoveredCat === i ? { boxShadow: `0 0 20px -4px ${cat.glow}` } : {}}
                    >
                      <cat.icon className={`h-6 w-6 ${cat.color}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-2">{cat.label}</h3>
                      <p className="text-slate-400 text-sm">{cat.desc}</p>
                    </div>
                    <div className={`absolute bottom-10 right-10 transition-all duration-300 ${hoveredCat === i ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1"}`}>
                      <ArrowRight className="h-5 w-5 text-blue-400" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5 — VENDOR NETWORK SHOWCASE */}
      <section className="py-24 relative overflow-hidden bg-[#040a15] border-t border-white/5">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <h2 className="text-4xl md:text-5xl font-bold text-white">Join the Vendor Network</h2>
              <p className="text-xl text-slate-400 font-light">Turn searches into sales. Connect your inventory to millions of buyers searching in real-time.</p>
              
              <ul className="space-y-4">
                {[
                  "Automated inventory syncing",
                  "Direct messaging with buyers",
                  "Analytics and demand forecasting",
                  "Verified business profiles"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-300">
                    <CheckCircle2 className="h-5 w-5 text-blue-400" /> {item}
                  </li>
                ))}
              </ul>

              <p className="text-sm text-slate-600">Trusted by 50,000+ vendors across 140 cities</p>

              <div className="pt-4">
                <Link href={vendorCtaHref}>
                  <Button size="lg" className="bg-white text-black hover:bg-slate-200 font-semibold px-8 h-12">
                    {user?.role === "VENDOR" ? "Go to Dashboard" : "Become a Vendor"} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="bg-[#06101f] border border-white/[0.07] rounded-2xl p-6 shadow-2xl relative">
                <div className="absolute top-4 right-4 text-[10px] bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-1 rounded-md">
                  ↑ 18% this week
                </div>
                
                <h3 className="text-lg font-semibold text-white mb-6">Performance Dashboard</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.04]">
                    <div className="text-xs text-slate-400 mb-1">Total Views</div>
                    <div className="text-2xl font-bold text-white">12.4k</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.04]">
                    <div className="text-xs text-slate-400 mb-1">New Orders</div>
                    <div className="text-2xl font-bold text-white">84</div>
                  </div>
                </div>

                <div className="h-36 w-full flex items-end gap-[4%] mb-6">
                  {[35, 60, 42, 85, 58, 95, 78].map((height, i) => (
                    <motion.div
                      key={i}
                      className="flex-1 rounded-t"
                      style={{ background: "linear-gradient(to top, rgba(59,130,246,0.2), rgba(59,130,246,0.6))" }}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${height}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: i * 0.08, ease: [0.23, 1, 0.32, 1] }}
                    />
                  ))}
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-white">Recent Activity</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm p-2 bg-white/[0.02] rounded pl-2 border-l-2 border-l-green-400">
                      <span className="text-slate-300">New Order #892</span>
                      <span className="text-slate-500">2m ago</span>
                    </div>
                    <div className="flex justify-between items-center text-sm p-2 bg-white/[0.02] rounded pl-2 border-l-2 border-l-blue-400">
                      <span className="text-slate-300">Inventory Synced</span>
                      <span className="text-slate-500">15m ago</span>
                    </div>
                    <div className="flex justify-between items-center text-sm p-2 bg-white/[0.02] rounded pl-2 border-l-2 border-l-amber-400">
                      <span className="text-slate-300">Buyer Inquiry</span>
                      <span className="text-slate-500">1h ago</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6 — SOCIAL PROOF */}
      <section className="py-24 bg-[#040a15] border-t border-white/5 relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4 text-white">Trusted by Industry Leaders</h2>
            <p className="text-slate-500 text-lg font-light mt-3">Businesses across every sector rely on Finder to source smarter.</p>
          </div>
          
          <div className="flex flex-wrap justify-center items-center gap-12 opacity-50 grayscale mb-16">
            {/* Logos mockup */}
            <div className="text-xl font-bold text-white flex items-center gap-2"><div className="w-6 h-6 bg-white rounded-sm" /> ACME Corp</div>
            <div className="text-xl font-bold text-white flex items-center gap-2"><div className="w-6 h-6 bg-white rounded-full" /> GlobalSys</div>
            <div className="text-xl font-bold text-white flex items-center gap-2"><div className="w-6 h-6 bg-white rotate-45" /> Nexus</div>
            <div className="text-xl font-bold text-white flex items-center gap-2"><div className="w-6 h-6 bg-white rounded-tr-xl" /> Prime Logistics</div>
          </div>

          {/* Marquee */}
          <div className="overflow-hidden w-full flex mb-20 border-y border-white/[0.05] py-4 bg-white/[0.01]">
            <div className="flex animate-marquee whitespace-nowrap" style={{ animationDuration: '30s' }}>
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex items-center">
                  {["Enterprise Security", "99.7% Uptime SLA", "Real-Time Sync", "Verified Vendors", "AI-Powered Discovery", "Global Network"].map((text, j) => (
                    <div key={j} className="flex items-center">
                      <span className="text-slate-500 text-xs font-medium tracking-widest uppercase mx-8">{text}</span>
                      <div className="w-1 h-1 rounded-full bg-slate-600" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { text: "Finder completely changed how we source medical supplies during critical shortages.", author: "Dr. Sarah Jenkins", role: "Head of Procurement, City Hospital" },
              { text: "Our sales increased 40% after joining the network. Buyers find us instantly now.", author: "Michael Chen", role: "Owner, Chen Industrial Supply" },
              { text: "The API integration was flawless. Real-time inventory syncing just works.", author: "Elena Rodriguez", role: "CTO, QuickMeds" }
            ].map((t, i) => (
              <div key={i} className="bg-white/[0.02] border border-white/5 border-l-2 border-l-blue-500/30 rounded-2xl p-8">
                <div className="flex gap-1 mb-4">
                  {[1,2,3,4,5].map(s => <Star key={s} className="w-4 h-4 text-blue-400 fill-blue-400" />)}
                </div>
                <p className="text-slate-300 mb-6 font-light">"{t.text}"</p>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-800 ring-2 ring-blue-500/20" />
                  <div>
                    <div className="text-sm font-semibold text-white">{t.author}</div>
                    <div className="text-xs text-slate-500">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST SIGNALS BAR */}
      <section className="py-16 bg-[#030810] border-t border-white/[0.04] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-950/10 via-transparent to-blue-950/10 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <p className="text-center text-[10px] uppercase tracking-[0.2em] text-slate-600 mb-10 font-medium">Enterprise-Grade Infrastructure</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              { value: "99.7%", label: "Uptime SLA", sub: "Guaranteed reliability", color: "text-green-400", glow: "rgba(74,222,128,0.15)" },
              { value: "AES-256", label: "Data Encryption", sub: "Bank-grade security", color: "text-blue-400", glow: "rgba(59,130,246,0.15)" },
              { value: "50K+", label: "Verified Vendors", sub: "ID-checked businesses", color: "text-amber-400", glow: "rgba(245,158,11,0.15)" },
              { value: "< 2s", label: "Query Response", sub: "Real-time discovery", color: "text-cyan-400", glow: "rgba(34,211,238,0.15)" },
            ].map((item, i) => (
              <div
                key={i}
                className="text-center p-5 rounded-2xl border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.03] transition-all duration-300 group"
              >
                <div className={`text-2xl font-bold mb-1 tabular-nums tracking-tight ${item.color}`} style={{ fontVariantNumeric: "tabular-nums" }}>{item.value}</div>
                <div className="text-[12px] font-semibold text-slate-300 mb-0.5">{item.label}</div>
                <div className="text-[10px] text-slate-600">{item.sub}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 mt-10">
            {["SOC 2 Type II Ready", "GDPR Compliant", "ISO 27001 Aligned", "End-to-End Encrypted", "Zero-Knowledge Architecture"].map((badge) => (
              <div key={badge} className="flex items-center gap-1.5 text-[10px] text-slate-600 font-medium">
                <div className="w-1 h-1 rounded-full bg-slate-700" />
                {badge}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-24 relative overflow-hidden bg-gradient-to-br from-blue-950/30 via-background to-background">
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white drop-shadow-[0_0_40px_rgba(59,130,246,0.12)]">Ready to Join the Network?</h2>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto font-light">Whether you are looking to source products or sell inventory, Finder connects you instantly.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button
                data-testid="btn-cta-search"
                size="lg"
                onClick={openSearch}
                className="h-14 px-8 text-lg bg-blue-600 hover:bg-blue-500 text-white w-full sm:w-auto cursor-pointer"
              >
                Start Searching Free
              </Button>
            <Link href={vendorCtaHref}>
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-white/20 hover:bg-white/10 w-full sm:w-auto">
                {user?.role === "VENDOR" ? "Go to Dashboard" : "Become a Vendor"}
              </Button>
            </Link>
          </div>
          <p className="text-sm text-slate-600 mt-6">No credit card required · Free to start · 2-minute setup</p>
        </div>
      </section>

      <Footer />

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
