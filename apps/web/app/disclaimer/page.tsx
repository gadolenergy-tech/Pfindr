"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

const SECTIONS = [
  {
    title: "Finder Does Not Own Listed Inventory",
    body: `All inventory listed on Finder is owned by and the sole responsibility of the vendors who have registered and listed it on the platform. Finder Platform Inc. acts exclusively as a discovery and matching intermediary. Finder does not hold, warehouse, sell, ship, or transfer any physical goods listed on the platform. Any transaction between a buyer and a vendor is a direct agreement between those two parties.`,
  },
  {
    title: "No Guarantee of Product Availability",
    body: `Finder does not guarantee the availability, quantity, or condition of any product listed on the platform. Inventory data displayed on Finder is supplied by vendors and synchronized at intervals determined by the vendor's chosen sync method. Real-world stock levels may differ from what is displayed on Finder at any given moment. Buyers are advised to confirm current availability directly with vendors before committing to a purchase.`,
  },
  {
    title: "Inventory Information Is Vendor-Supplied",
    body: `All inventory descriptions, quantities, images, specifications, pricing, and availability statuses displayed on Finder are provided by vendors. Finder uses automated tools to detect inconsistencies, but cannot independently verify every piece of information submitted by vendors. Finder makes no representation or warranty as to the accuracy, completeness, or reliability of vendor-supplied inventory data.`,
  },
  {
    title: "Finder Is a Discovery and Matching Platform",
    body: `Finder's role is limited to facilitating discovery — connecting buyers who need products with vendors who have listed those products. Finder is not a party to any transaction, agreement, or contract that may arise between a buyer and a vendor as a result of a discovery made through the platform. Finder does not act as an agent, broker, distributor, or representative of any vendor listed on the platform.`,
  },
  {
    title: "Pricing and Availability May Change",
    body: `Prices and availability displayed on Finder reflect vendor-submitted data at the time of the most recent inventory sync. Prices are subject to change without notice. Market conditions, supply chain disruptions, and vendor decisions may cause prices and availability to differ materially from what is shown. Finder is not responsible for any pricing discrepancies between what is displayed on the platform and what a vendor charges at the point of sale.`,
  },
  {
    title: "Verify Before Transacting",
    body: `Users are strongly advised to confirm all product information — including specifications, pricing, quantities, expiration dates (where applicable), and regulatory compliance — directly with the vendor before completing any transaction. This is particularly important for healthcare products, pharmaceuticals, industrial equipment, and other regulated goods where accuracy is safety-critical.`,
  },
  {
    title: "Healthcare and Regulated Products",
    body: `Finder may display listings for medical supplies, pharmaceuticals, laboratory equipment, and other regulated products. The display of such products on Finder does not constitute endorsement, approval, or certification of those products or the vendors who list them. Buyers procuring regulated goods are solely responsible for verifying that the vendor holds all required licenses, certifications, and regulatory approvals.`,
  },
  {
    title: "AI-Generated Recommendations and Insights",
    body: `Finder uses artificial intelligence to power search results, vendor recommendations, AI Inventory Sync scanning, and demand intelligence signals. These AI-generated outputs are provided for informational purposes only and should not be relied upon as professional, medical, legal, or financial advice. AI results may contain errors, and users should exercise independent judgment when making procurement decisions.`,
  },
  {
    title: "Limitation of Finder's Liability",
    body: `Finder Platform Inc. expressly disclaims all warranties, express or implied, regarding the platform and any inventory or vendor information displayed thereon, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement. To the fullest extent permitted by applicable law, Finder shall not be liable for any loss, damage, or harm arising from reliance on inventory data, vendor representations, or AI-generated outputs provided through the platform.`,
  },
  {
    title: "External Links and Third-Party Services",
    body: `Finder may contain links to external websites or services operated by third parties, including vendor websites and integrated platforms. Finder is not responsible for the content, privacy practices, or reliability of any third-party websites or services. The inclusion of any external link does not constitute an endorsement or recommendation by Finder.`,
  },
];

export default function Disclaimer() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-28 pb-24">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-5">
              <AlertTriangle className="h-3 w-3" /> Important Notice
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">Platform Disclaimer</h1>
            <p className="text-slate-400 text-lg font-light leading-relaxed">Finder connects buyers and vendors in a live discovery network. Please read this disclaimer carefully to understand Finder's role, limitations, and your responsibilities as a platform user.</p>
            <p className="text-sm text-slate-500 mt-4">Last updated: June 22, 2026 · Finder Platform Inc.</p>
          </div>

          <div className="p-5 bg-amber-500/[0.06] border border-amber-500/[0.15] rounded-2xl mb-10">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-300 mb-1">Important</p>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Finder is a <strong className="text-white">discovery platform</strong>, not a seller or distributor. Always verify product availability, pricing, and vendor credentials directly before completing any transaction — especially for medical, pharmaceutical, or industrial goods.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {SECTIONS.map((section) => (
              <div key={section.title} className="border-b border-white/[0.04] pb-8 last:border-0">
                <h2 className="text-base font-semibold text-white mb-3">{section.title}</h2>
                <p className="text-slate-400 text-sm leading-7">{section.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 p-6 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
            <h3 className="text-sm font-semibold text-white mb-2">Need Clarification?</h3>
            <p className="text-sm text-slate-400 mb-4">If you have questions about how Finder operates or your rights as a buyer or vendor, our team is available to assist.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/contact">
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">Contact Us</button>
              </Link>
              <Link href="/terms">
                <button className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 text-sm font-medium rounded-lg border border-white/[0.08] transition-colors">Terms of Service</button>
              </Link>
              <Link href="/privacy">
                <button className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 text-sm font-medium rounded-lg border border-white/[0.08] transition-colors">Privacy Policy</button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
