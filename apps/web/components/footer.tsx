"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function Footer() {
  const { user } = useAuth();
  // An already-registered vendor should land on their own dashboard, not
  // restart the vendor onboarding flow and appear to lose their products.
  const vendorPortalHref = user?.role === "VENDOR" ? "/vendor/dashboard" : "/vendor/signup";

  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground font-bold text-xl">
                F
              </div>
              <span className="font-bold text-xl tracking-tight">Finder</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              AI-Powered Inventory Intelligence &amp; Procurement Network. Find anything, anywhere, instantly.
            </p>
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed max-w-xs">
              From blood banks and pharmacies to industrial tools and food — Finder connects people to real inventory from real vendors in real time.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-sm">Platform</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/" className="hover:text-primary transition-colors">Discover Inventory</Link></li>
              <li><Link href="/how-it-works" className="hover:text-primary transition-colors">How It Works</Link></li>
              <li><Link href={vendorPortalHref} className="hover:text-primary transition-colors">Vendor Portal</Link></li>
              <li><Link href="/affiliate" className="hover:text-primary transition-colors">Affiliate Program</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-sm">Developers</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/developers" className="hover:text-primary transition-colors">Developer Portal</Link></li>
              <li><Link href="/developers" className="hover:text-primary transition-colors">API Documentation</Link></li>
              <li><Link href="/partners" className="hover:text-primary transition-colors">Partner With Finder</Link></li>
              <li><Link href="/contact" className="hover:text-primary transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-sm">Legal</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link href="/disclaimer" className="hover:text-primary transition-colors">Disclaimer</Link></li>
              <li><Link href="/about" className="hover:text-primary transition-colors">About Us</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Finder Platform Inc. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-foreground transition-colors">Twitter</Link>
            <Link href="#" className="hover:text-foreground transition-colors">LinkedIn</Link>
            <Link href="/developers" className="hover:text-foreground transition-colors">API</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
