"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, Network, Cpu, ShieldCheck } from "lucide-react";

export default function About() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10 text-center max-w-4xl">
          <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-8">
            Mission & Vision
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
            Rewiring Global <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Inventory</span>
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            We believe finding essential supplies shouldn't be a fragmented, opaque process. 
            Finder is building the world's most comprehensive neural network of real-time inventory, 
            connecting buyers with verified suppliers instantly.
          </p>
        </div>
      </section>

      <section className="py-24 bg-card">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">The Problem: Fragmentation</h2>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                Before Finder, locating critical inventory—from medical supplies to industrial tools—required navigating a maze of disconnected systems, endless phone calls, and outdated catalogs.
              </p>
              <p className="text-muted-foreground text-lg leading-relaxed">
                This fragmentation costs businesses billions in delays, missed opportunities, and inefficient procurement cycles. We knew there had to be a better way.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-background/50 border-border/50">
                <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                  <Globe className="h-8 w-8 text-primary" />
                  <h3 className="font-semibold">Global Reach</h3>
                  <p className="text-sm text-muted-foreground">Mapping suppliers across 140+ cities.</p>
                </CardContent>
              </Card>
              <Card className="bg-background/50 border-border/50">
                <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                  <Cpu className="h-8 w-8 text-secondary" />
                  <h3 className="font-semibold">AI Powered</h3>
                  <p className="text-sm text-muted-foreground">Intelligent parsing of unstructured catalog data.</p>
                </CardContent>
              </Card>
              <Card className="bg-background/50 border-border/50">
                <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                  <Network className="h-8 w-8 text-blue-400" />
                  <h3 className="font-semibold">Real-time Node</h3>
                  <p className="text-sm text-muted-foreground">Instant availability checks across networks.</p>
                </CardContent>
              </Card>
              <Card className="bg-background/50 border-border/50">
                <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                  <ShieldCheck className="h-8 w-8 text-green-400" />
                  <h3 className="font-semibold">Verified Trust</h3>
                  <p className="text-sm text-muted-foreground">Strict vetting for all suppliers on the platform.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-background border-t border-border/50">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-8">Our Intelligent Network</h2>
          <div className="aspect-[21/9] bg-card rounded-2xl border border-border/50 relative overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
            <div className="text-muted-foreground relative z-10 flex flex-col items-center gap-4">
              <Network className="h-12 w-12 text-primary animate-pulse" />
              <p className="text-lg font-medium">Neural Inventory Graph Visualization</p>
            </div>
          </div>
          <p className="text-muted-foreground mt-8 text-lg">
            Finder's proprietary AI normalizes diverse inventory data structures, making them searchable via natural language. We don't just find suppliers; we find the exact items you need, exactly when you need them.
          </p>
        </div>
      </section>
      
      <Footer />
    </div>
  );
}
