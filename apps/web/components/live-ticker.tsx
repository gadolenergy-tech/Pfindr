"use client";

import { Zap, Activity, Package, MapPin } from "lucide-react";

const EVENTS = [
  { icon: Zap, text: "AI matched 47 vendors for blood type A+" },
  { icon: Package, text: "1,240 units of Amoxicillin indexed — Lagos" },
  { icon: MapPin, text: "New vendor: MedEquip Pro joined from Abuja" },
  { icon: Activity, text: "₦2.3M procurement processed via Finder" },
  { icon: Zap, text: "Real-time sync: PetroSupply inventory updated" },
  { icon: Package, text: "Emergency oxygen stock discovered — 14 units" },
  { icon: MapPin, text: "GrainStore NG: 640 rice bags available now" },
  { icon: Activity, text: "Vendor response time: 1.2s average this hour" },
];

// Duplicate the events array so the marquee loops seamlessly
const DOUBLED = [...EVENTS, ...EVENTS];

export function LiveTicker() {
  return (
    <div className="relative overflow-hidden border-y border-white/[0.04] bg-[#030810] py-3">
      {/* Left/right fade masks */}
      <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#030810] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#030810] to-transparent z-10 pointer-events-none" />

      <div
        className="flex items-center gap-10 whitespace-nowrap animate-marquee"
        style={{ animationDuration: "40s" }}
      >
        {DOUBLED.map((event, i) => (
          <span key={i} className="flex items-center gap-2 text-[11px] text-slate-600 font-medium shrink-0">
            <event.icon className="h-3 w-3 text-blue-500/60 shrink-0" />
            {event.text}
          </span>
        ))}
      </div>
    </div>
  );
}