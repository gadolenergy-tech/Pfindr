"use client";

import { VendorSidebar } from "@/components/vendor-sidebar";
import { Inbox } from "@/components/messages/inbox";

export default function VendorMessages() {
  return (
    <div className="min-h-screen flex bg-[#040a15]">
      <VendorSidebar />
      <main className="flex-1 flex overflow-hidden h-screen">
        <Inbox emptyHint="No messages yet. Buyers reach you here when they request a quote from search." />
      </main>
    </div>
  );
}
