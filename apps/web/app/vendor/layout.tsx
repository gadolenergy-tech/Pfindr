"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth-guard";

/** Routes under /vendor that a signed-out visitor must still be able to reach. */
const PUBLIC_VENDOR_ROUTES = ["/vendor/signup"];

export default function VendorLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (PUBLIC_VENDOR_ROUTES.includes(pathname)) return <>{children}</>;

  return <AuthGuard roles={["VENDOR", "ADMIN"]}>{children}</AuthGuard>;
}
