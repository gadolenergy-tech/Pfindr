"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Search, BrainCircuit, Box, ArrowRightLeft, Handshake, Truck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HowItWorks() {
  const steps = [
    {
      icon: Search,
      title: "1. Intent-Based Search",
      desc: "Enter your requirements in plain English. No exact SKU matches needed—our semantic search understands context, brand alternatives, and technical specifications."
    },
    {
      icon: BrainCircuit,
      title: "2. AI Vendor Matching",
      desc: "Our engine queries a distributed database of thousands of verified vendors instantly, filtering by category, compliance, and location."
    },
    {
      icon: Box,
      title: "3. Real-Time Stock Check",
      desc: "Live API integrations and predictive models confirm current stock levels, preventing backorders and out-of-stock surprises."
    },
    {
      icon: ArrowRightLeft,
      title: "4. Compare Quotes",
      desc: "View aggregated results side-by-side. Compare pricing, bulk discounts, shipping times, and vendor ratings on a single dashboard."
    },
    {
      icon: Handshake,
      title: "5. Connect & Transact",
      desc: "Communicate directly with suppliers via our secure platform. Finalize terms, execute purchase orders, and release funds securely."
    },
    {
      icon: Truck,
      title: "6. End-to-End Fulfillment",
      desc: "Track logistics from warehouse to your door. Real-time updates ensure your supply chain remains predictable and reliable."
    }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <section className="py-24 border-b border-border/50 text-center relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background"></div>
        <div className="container mx-auto px-4 relative z-10">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">How Finder Works</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            From complex industrial requirements to emergency medical supplies, our platform simplifies the entire procurement lifecycle.
          </p>
        </div>
      </section>

      <section className="py-24 bg-card/30">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid gap-12 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute left-[50%] top-0 bottom-0 w-px bg-border/50 -translate-x-1/2"></div>
            
            {steps.map((step, i) => (
              <div key={i} className={`flex flex-col md:flex-row items-center gap-8 ${i % 2 !== 0 ? 'md:flex-row-reverse' : ''}`}>
                <div className="flex-1 w-full text-center md:text-left">
                  <Card className="bg-background border-border/50 hover-elevate transition-all duration-300">
                    <CardContent className="p-8">
                      <div className={`mb-6 p-4 rounded-2xl bg-primary/10 inline-block text-primary`}>
                        <step.icon className="h-8 w-8" />
                      </div>
                      <h3 className="text-2xl font-bold mb-4">{step.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="hidden md:flex flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground items-center justify-center font-bold text-lg z-10 shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                  {i + 1}
                </div>
                <div className="flex-1 w-full"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">Ready to streamline your supply chain?</h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="h-14 px-8 text-lg">Create Buyer Account</Button>
            </Link>
            <Link href="/vendor/signup">
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg">Apply as Vendor</Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
