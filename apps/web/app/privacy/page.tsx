"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import Link from "next/link";

const SECTIONS = [
  {
    title: "1. Data We Collect",
    body: `When you use Finder, we collect information you provide directly — including business name, contact information, account credentials, and inventory data submitted through any sync method. We also collect usage data automatically, such as pages visited, search queries performed, device information, IP addresses, browser type, and timestamps of interactions. Payment information (where applicable) is processed by PCI-compliant third-party payment processors and is never stored on Finder servers.`,
  },
  {
    title: "2. Inventory Data Handling",
    body: `Inventory data submitted by vendors is stored securely and used exclusively to power Finder's discovery and procurement matching capabilities. Inventory data is indexed, searchable by verified buyers, and displayed in real-time discovery results. Vendors retain full ownership of their inventory data at all times. Finder does not sell, license, or transfer vendor inventory data to third parties for marketing, advertising, or resale purposes.`,
  },
  {
    title: "3. Business Information Processing",
    body: `Business verification information, including company registration documents, tax identification numbers, and identity verification data, is processed for the sole purpose of verifying vendor eligibility on the platform. This information is stored in encrypted form and accessed only by authorized Finder compliance personnel. Finder may share verification status (not the underlying documents) with buyers to indicate vendor trustworthiness.`,
  },
  {
    title: "4. Customer Information",
    body: `Buyer account information is used to facilitate inventory discovery, quote requests, and vendor-buyer communication. Finder does not share buyer personal information with vendors beyond what is necessary to fulfill a procurement request. Buyers may choose to provide contact information directly to vendors during the inquiry process — this is at the buyer's discretion and is governed by the vendor's own privacy practices.`,
  },
  {
    title: "5. Analytics Usage",
    body: `Finder uses aggregated, anonymized analytics to understand platform usage patterns, improve search relevance, and optimize inventory discovery. Individual user behavior is analyzed internally to improve the AI recommendation engine and search quality. We do not sell individual behavioral data to advertisers. Aggregated, anonymized market intelligence (e.g., trending search categories in a region) may be used in platform reports and industry communications.`,
  },
  {
    title: "6. Cookies & Tracking",
    body: `Finder uses cookies and similar tracking technologies to maintain session state, remember user preferences, and analyze usage patterns. Essential cookies are required for platform functionality. Analytics cookies are optional and may be controlled through your browser settings or our cookie preference center. We do not use third-party advertising cookies or cross-site behavioral tracking networks.`,
  },
  {
    title: "7. Third-Party Integrations",
    body: `When you connect a third-party system (such as a POS, ERP, or inventory management platform) to Finder via the API Integration or POS Integration methods, Finder receives only the inventory data you authorize. Finder requests read-only access and never stores your third-party platform credentials directly. OAuth tokens are stored in Finder's encrypted secrets vault with automatic rotation.`,
  },
  {
    title: "8. Data Retention",
    body: `Active account data is retained for the duration of your account's existence on the platform. Inventory data is refreshed continuously and historical inventory snapshots are retained for up to 24 months for audit and reconciliation purposes. Upon account deletion, all personal data and inventory records are permanently purged within 30 days, except where retention is required by applicable law or regulatory obligation.`,
  },
  {
    title: "9. Your Rights",
    body: `Depending on your jurisdiction, you may have rights including: the right to access your personal data; the right to correct inaccurate data; the right to request deletion of your data; the right to data portability; the right to object to or restrict certain processing; and the right to withdraw consent where processing is based on consent. To exercise any of these rights, contact our Data Protection Team at privacy@finder.ai. We will respond within 30 days.`,
  },
  {
    title: "10. Security Practices",
    body: `Finder employs enterprise-grade security practices across the full data lifecycle. All data in transit is protected by TLS 1.3. All data at rest is encrypted with AES-256. Access to sensitive data is restricted to authorized personnel on a need-to-know basis, enforced through role-based access controls and multi-factor authentication. Our infrastructure undergoes regular third-party security audits and penetration testing. In the event of a data breach that affects your personal data, we will notify you within 72 hours as required by applicable law.`,
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-28 pb-24">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-5">
              Legal Document
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">Privacy Policy</h1>
            <p className="text-slate-400 text-lg font-light leading-relaxed">Finder is committed to protecting your personal and business data. This policy explains what we collect, how we use it, and the rights you have over your information.</p>
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
            <h3 className="text-sm font-semibold text-white mb-2">Privacy Questions or Requests?</h3>
            <p className="text-sm text-slate-400 mb-4">Contact our Data Protection Team to exercise your rights or raise a concern.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/contact">
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">Contact DPT</button>
              </Link>
              <Link href="/terms">
                <button className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 text-sm font-medium rounded-lg border border-white/[0.08] transition-colors">Terms of Service</button>
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
