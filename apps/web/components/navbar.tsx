"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Menu, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState, useEffect } from "react";

const NAV_LINKS = [
  { href: "/", label: "Discover" },
  { href: "/about", label: "About Us" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/contact", label: "Contact Us" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { user, logout } = useAuth();
  const { count: cartCount } = useCart();
  const location = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-white/10 shadow-xl py-3"
          : "bg-transparent border-transparent py-5"
      }`}
    >
      <div className="container mx-auto flex h-10 items-center justify-between px-4">
        <div className="flex items-center gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-2 group">
            <div
              className={`flex items-center justify-center rounded bg-primary text-primary-foreground font-bold transition-all duration-300 ${
                scrolled ? "h-8 w-8 text-lg" : "h-10 w-10 text-xl"
              }`}
            >
              F
            </div>
            <span
              className={`hidden font-bold sm:inline-block tracking-tight transition-all duration-300 ${
                scrolled ? "text-xl" : "text-2xl"
              }`}
            >
              Finder
            </span>
          </Link>

          <nav className="hidden gap-1 md:flex">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                    active
                      ? "text-white"
                      : "text-muted-foreground hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  {active && (
                    <span className="absolute inset-0 rounded-md bg-white/[0.05] border border-white/[0.07]" />
                  )}
                  <span className="relative">{link.label}</span>
                  {active && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full bg-blue-400" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <Link
                href={user.role === "VENDOR" ? "/vendor/dashboard" : "/messages"}
                className="text-sm font-medium text-muted-foreground hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-white/[0.04]"
              >
                {user.role === "VENDOR" ? "Dashboard" : "Messages"}
              </Link>
              {user.role !== "VENDOR" && (
                <Link
                  href="/orders"
                  data-testid="link-nav-orders"
                  className="text-sm font-medium text-muted-foreground hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-white/[0.04]"
                >
                  My orders
                </Link>
              )}
              {user.role !== "VENDOR" && (
                <Link
                  href="/cart"
                  data-testid="link-nav-cart"
                  aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
                  className="relative text-muted-foreground hover:text-white transition-colors p-2 rounded-md hover:bg-white/[0.04]"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {cartCount > 0 && (
                    <span data-testid="nav-cart-count" className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold leading-4 text-center tabular-nums">
                      {cartCount > 99 ? "99+" : cartCount}
                    </span>
                  )}
                </Link>
              )}
              <Button
                data-testid="btn-nav-logout"
                size="sm"
                variant="outline"
                onClick={() => void logout()}
                className="h-9 px-4 text-sm border-white/[0.12]"
              >
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-white/[0.04]">
                Login
              </Link>
              <Button
                asChild
                data-testid="btn-nav-signup"
                size="sm"
                className="shadow-[0_0_15px_-5px_rgba(59,130,246,0.5)] h-9 px-4 text-sm"
              >
                <Link href="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden text-slate-300">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-[300px] sm:w-[360px] bg-[#060d1f]/98 backdrop-blur-2xl border-white/[0.07]"
          >
            <nav className="flex flex-col gap-1 mt-10">
              {NAV_LINKS.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-150 ${
                      active
                        ? "text-white bg-white/[0.06] border border-white/[0.08]"
                        : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />}
                    {link.label}
                  </Link>
                );
              })}
              <div className="flex flex-col gap-2.5 mt-6 px-1">
                {user ? (
                  <>
                    <Button asChild variant="ghost" className="w-full justify-start text-slate-400 hover:text-white border border-white/[0.07] hover:bg-white/[0.05]">
                      <Link href={user.role === "VENDOR" ? "/vendor/dashboard" : "/messages"}>
                        {user.role === "VENDOR" ? "Dashboard" : "Messages"}
                      </Link>
                    </Button>
                    {user.role !== "VENDOR" && (
                      <Button asChild variant="ghost" className="w-full justify-start text-slate-400 hover:text-white border border-white/[0.07] hover:bg-white/[0.05]">
                        <Link href="/orders">My orders</Link>
                      </Button>
                    )}
                    {user.role !== "VENDOR" && (
                      <Button asChild variant="ghost" className="w-full justify-start text-slate-400 hover:text-white border border-white/[0.07] hover:bg-white/[0.05]">
                        <Link href="/cart">Cart{cartCount > 0 ? ` (${cartCount})` : ""}</Link>
                      </Button>
                    )}
                    <Button
                      onClick={() => void logout()}
                      className="w-full justify-start bg-blue-600 hover:bg-blue-500"
                    >
                      Log out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild variant="ghost" className="w-full justify-start text-slate-400 hover:text-white border border-white/[0.07] hover:bg-white/[0.05]">
                      <Link href="/login">Login</Link>
                    </Button>
                    <Button asChild className="w-full justify-start bg-blue-600 hover:bg-blue-500">
                      <Link href="/signup">Sign Up</Link>
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
