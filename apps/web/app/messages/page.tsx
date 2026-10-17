"use client";

import { Navbar } from "@/components/navbar";
import { Inbox } from "@/components/messages/inbox";
import { AuthGuard } from "@/components/auth-guard";

/** A buyer's inbox — where vendor replies to quote requests land. */
export default function BuyerMessages() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#040a15]">
        <Navbar />
        <main className="flex h-screen pt-[72px] overflow-hidden">
          <Inbox emptyHint="No conversations yet. Search for a product and request a quote to start one." />
        </main>
      </div>
    </AuthGuard>
  );
}
