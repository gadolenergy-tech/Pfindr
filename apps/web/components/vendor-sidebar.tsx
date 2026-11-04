"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  PackageSearch,
  ShoppingCart,
  Users,
  BarChart3,
  MessageSquare,
  Settings,
  Plug,
  LogOut,
  Menu,
} from "lucide-react";

export function VendorSidebar() {
  const { user, logout } = useAuth();
  const initial = (user?.fullName ?? "V").charAt(0).toUpperCase();
  const location = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/vendor/dashboard" },
    { icon: PackageSearch, label: "Inventory", href: "/vendor/inventory" },
    { icon: ShoppingCart, label: "Orders", href: "/vendor/orders" },
    { icon: Users, label: "Customers", href: "/vendor/customers" },
    { icon: BarChart3, label: "Analytics", href: "/vendor/analytics" },
    { icon: MessageSquare, label: "Messages", href: "/vendor/messages" },
    { icon: Plug, label: "API & Integrations", href: "/vendor/api-integrations" },
    { icon: Settings, label: "Settings", href: "/vendor/settings" },
  ];

  const isActive = (href: string) => location === href || location.startsWith(href + "/");

  const panel = (onNavigate?: () => void) => (
    <>
      <div className="h-16 flex items-center px-6 border-b border-white/[0.06]">
        <Link href="/" onClick={onNavigate} className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground font-bold text-xl">
            F
          </div>
          <span className="font-bold text-xl tracking-tight text-white">Vendor</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-0.5">
        {links.map((link) => {
          const active = isActive(link.href);
          return (
            <Link key={link.href} href={link.href} onClick={onNavigate}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 cursor-pointer ${
                  active
                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/[0.18]"
                    : "text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]"
                }`}
              >
                <link.icon className={`h-4 w-4 shrink-0 ${active ? "text-blue-400" : "text-slate-600"}`} />
                {link.label}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/[0.02]">
          <div className="h-9 w-9 rounded-full bg-slate-800 border border-white/[0.1] flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-slate-400">{initial}</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-[12px] font-semibold text-slate-200 truncate">
              {user?.fullName ?? "Vendor"}
            </p>
            <p className="text-[10px] text-slate-600 truncate">
              {user?.vendorId ? `Vendor ID: ${user.vendorId.slice(-6)}` : "Profile pending"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="w-full flex items-center gap-3 px-3 py-2.5 mt-1 rounded-xl text-[13px] font-medium text-slate-600 hover:text-slate-300 hover:bg-white/[0.04] transition-all cursor-pointer"
        >
          <LogOut className="h-4 w-4 shrink-0" /> Log out
        </button>
      </div>
      <div className="px-5 py-3 border-t border-white/[0.04]">
        <div className="flex items-center gap-2 text-[10px] text-slate-700">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400/50 animate-pulse" />
          AI engine running
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden lg:flex w-64 flex-col border-r border-white/[0.06] bg-[#04091a] h-screen sticky top-0">
        {panel()}
      </aside>

      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center gap-3 px-4 border-b border-white/[0.06] bg-[#04091a]/95 backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          className="h-9 w-9 -ml-1 flex items-center justify-center rounded-lg text-slate-300 hover:bg-white/[0.06]"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-bold text-lg tracking-tight text-white">Vendor</span>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="lg:hidden w-72 max-w-[85vw] p-0 flex flex-col bg-[#04091a] border-white/[0.06]">
          <SheetTitle className="sr-only">Vendor navigation</SheetTitle>
          {panel(() => setOpen(false))}
        </SheetContent>
      </Sheet>
    </>
  );
}
