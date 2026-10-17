"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import Link from "next/link";

const SECTIONS = [
  {
    title: "1. Platform Usage",
    body: `Finder provides an AI-powered inventory discovery and procurement network platform. By accessing or using Finder, you agree to be bound by these Terms of Service and all applicable laws. You must be at least 18 years of age and have the legal authority to enter into binding agreements on behalf of yourself or your organization. Finder reserves the right to modify, suspend, or terminate the platform or any portion thereof at any time without liability.`,
  },
  {
    title: "2. Vendor Responsibilities",
    body: `Vendors registered on Finder are solely responsible for the accuracy, completeness, and legality of all inventory data submitted to the platform. Vendors must ensure they have the legal right to list, sell, and fulfill orders for all products published on the platform. Vendors must comply with all applicable local, national, and international laws and regulations governing their products and business operations, including but not limited to licensing requirements, health and safety regulations, and export controls.`,
  },
  {
    title: "3. Inventory Accuracy Requirements",
    body: `Vendors are required to maintain accurate and current inventory data on Finder at all times. Inventory listings must reflect actual available stock quantities, current pricing, and correct product specifications. Finder employs automated systems to monitor inventory freshness and accuracy. Vendors with consistently outdated or inaccurate inventory may be downgraded, suspended, or removed from the platform. Finder is not liable for any losses arising from inaccurate inventory data submitted by vendors.`,
  },
  {
    title: "4. Acceptable Use Policy",
    body: `Users and vendors agree not to use Finder for any unlawful purpose, including the listing of prohibited, counterfeit, hazardous, or stolen goods. You may not attempt to gain unauthorized access to any portion of the platform, reverse-engineer any Finder technology, use automated scraping tools, or interfere with the platform's infrastructure. Finder reserves the right to immediately terminate accounts engaging in prohibited activities and to report such activities to relevant authorities.`,
  },
  {
    title: "5. Intellectual Property",
    body: `All technology, design, algorithms, software, brand identity, and content created by Finder Platform Inc. are the exclusive intellectual property of Finder Platform Inc. and are protected under applicable copyright, trademark, and patent laws. Vendors retain ownership of their inventory data. By submitting inventory data to Finder, vendors grant Finder a limited, non-exclusive, royalty-free license to display, index, and distribute that data within the Finder network for the purpose of facilitating procurement discovery.`,
  },
  {
    title: "6. API Usage Terms",
    body: `API access is provided to verified vendors and authorized developers under the terms of the Finder Developer Agreement. API keys must not be shared, published, or used in violation of these terms. Rate limits apply to all API endpoints. Finder reserves the right to revoke API access for abuse or violations. Commercial use of Finder's API beyond the scope of the vendor's own inventory management requires a separate enterprise agreement.`,
  },
  {
    title: "7. Affiliate Program Terms",
    body: `Participants in the Finder Affiliate Program agree to promote the platform ethically and accurately. Affiliates may not make false claims about platform capabilities, guarantees, or returns. Commission structures are defined in the Affiliate Program Agreement and are subject to change with 30 days' notice. Finder reserves the right to withhold commissions for accounts flagged for fraudulent referrals or violations of these terms.`,
  },
  {
    title: "8. Service Availability",
    body: `Finder targets a 99.7% uptime SLA for its core discovery and inventory services. Scheduled maintenance windows will be communicated at least 48 hours in advance. Finder is not liable for losses arising from downtime caused by force majeure events, third-party infrastructure failures, or circumstances outside Finder's reasonable control. Enterprise customers with custom SLA requirements should contact our enterprise sales team.`,
  },
  {
    title: "9. Limitation of Liability",
    body: `To the maximum extent permitted by applicable law, Finder Platform Inc. shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, loss of data, business interruption, or reputational harm, arising from your use of or inability to use the platform. Finder's total aggregate liability to any user or vendor shall not exceed the greater of (a) the amounts paid by that party to Finder in the 12 months preceding the claim, or (b) USD $100.`,
  },
  {
    title: "10. Account Suspension Policy",
    body: `Finder reserves the right to suspend or permanently terminate any account that violates these Terms, engages in fraudulent activity, submits repeatedly inaccurate inventory data, or creates risk for other users or the platform. Suspension notices will be sent to the registered email address. Vendors may appeal suspension decisions by contacting Finder Support within 14 days of notification. Finder's decision on appeals is final.`,
  },
  {
    title: "11. Dispute Resolution",
    body: `Any disputes arising under these Terms shall first be addressed through good-faith negotiation between the parties. If a dispute cannot be resolved informally within 30 days, it shall be submitted to binding arbitration administered by a mutually agreed arbitration body. Class action lawsuits and jury trials are expressly waived to the extent permitted by law. Nothing in this section prevents either party from seeking emergency injunctive relief in a court of competent jurisdiction.`,
  },
  {
    title: "12. Governing Law",
    body: `These Terms of Service are governed by and construed in accordance with applicable commercial law. By using Finder, you consent to the exclusive jurisdiction of the courts or arbitration bodies designated by Finder for the resolution of disputes. If any provision of these Terms is found to be unenforceable, the remaining provisions shall remain in full force and effect.`,
  },
];

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-28 pb-24">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-5">
              Legal Document
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">Terms of Service</h1>
            <p className="text-slate-400 text-lg font-light leading-relaxed">Please read these terms carefully before using the Finder platform. By accessing or using Finder, you agree to be bound by these Terms of Service.</p>
            <p className="text-sm text-slate-500 mt-4">Last updated: June 22, 2026 · Finder Platform Inc.</p>
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
            <h3 className="text-sm font-semibold text-white mb-2">Questions about these Terms?</h3>
            <p className="text-sm text-slate-400 mb-4">Our legal and compliance team is available to assist vendors, buyers, and enterprise customers.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/contact">
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">Contact Legal Team</button>
              </Link>
              <Link href="/privacy">
                <button className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 text-sm font-medium rounded-lg border border-white/[0.08] transition-colors">Privacy Policy</button>
              </Link>
              <Link href="/disclaimer">
                <button className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 text-sm font-medium rounded-lg border border-white/[0.08] transition-colors">Disclaimer</button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
