"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Store,
  Users,
  Mail,
  Handshake,
  ScrollText,
  Boxes,
  LogOut,
  Share2,
  Banknote,
  Menu,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AuthGuard } from "@/components/auth-guard";

const NAV = [
  { icon: LayoutDashboard, label: "Overview", href: "/" },
  { icon: Store, label: "Vendors", href: "/vendors" },
  { icon: Users, label: "Users", href: "/users" },
  { icon: Boxes, label: "Inventory", href: "/inventory" },
  { icon: Mail, label: "Contact", href: "/contact" },
  { icon: Handshake, label: "Partners", href: "/partners" },
  { icon: Share2, label: "Affiliates", href: "/affiliates" },
  { icon: Banknote, label: "Payouts", href: "/payouts" },
  { icon: ScrollText, label: "Audit log", href: "/audit" },
];

function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const panel = (onNavigate?: () => void) => (
    <>
      <div className="h-16 flex items-center px-6 border-b border-white/[0.06]">
        <Link href="/" onClick={onNavigate} className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground font-bold text-xl">
            F
          </div>
          <span className="font-bold text-xl tracking-tight text-white">Ops</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-0.5">
        {NAV.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                active
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/[0.18]"
                  : "text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]"
              }`}
            >
              <link.icon
                className={`h-4 w-4 shrink-0 ${active ? "text-blue-400" : "text-slate-600"}`}
              />
              {link.label}
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/[0.02]">
          <div className="h-9 w-9 rounded-full bg-slate-800 border border-white/[0.1] flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-slate-400">
              {(user?.fullName ?? "A").charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-[12px] font-semibold text-slate-200 truncate">
              {user?.fullName ?? "Operator"}
            </p>
            <p className="text-[10px] text-slate-600 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="w-full flex items-center gap-3 px-3 py-2.5 mt-1 rounded-xl text-[13px] font-medium text-slate-600 hover:text-slate-300 hover:bg-white/[0.04] transition-all"
        >
          <LogOut className="h-4 w-4 shrink-0" /> Log out
        </button>
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
        <span className="font-bold text-lg tracking-tight text-white">Ops</span>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="lg:hidden w-72 max-w-[85vw] p-0 flex flex-col bg-[#04091a] border-white/[0.06]">
          <SheetTitle className="sr-only">Ops navigation</SheetTitle>
          {panel(() => setOpen(false))}
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Chrome plus the ADMIN-role gate, wrapped around every console page. */
export function AdminShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AuthGuard roles={["ADMIN"]} redirectTo="/login">
      <div className="min-h-screen bg-background flex max-lg:pt-14">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="min-h-16 py-2 gap-3 flex items-center justify-between px-4 sm:px-8 border-b border-white/[0.06] bg-[#040a15]/90 backdrop-blur-xl z-10 sticky top-14 lg:top-0">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-white tracking-tight">
                {title}
              </h1>
              {description && (
                <p className="text-xs text-slate-500">{description}</p>
              )}
            </div>
            {actions}
          </header>
          <div className="flex-1 p-4 sm:p-8 space-y-6 sm:space-y-8">{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}
