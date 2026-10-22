"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { Role } from "@finder/shared";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/ui/spinner";

/**
 * Client-side gate for the authenticated areas. The API is the real authority —
 * every protected endpoint checks the token again — so this only decides what
 * the browser renders while the session resolves.
 */
export function AuthGuard({
  children,
  roles,
  redirectTo = "/login",
}: {
  children: ReactNode;
  roles?: Role[];
  redirectTo?: string;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const allowed = user && (!roles || roles.includes(user.role));

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = encodeURIComponent(pathname);
      router.replace(`${redirectTo}?next=${next}`);
      return;
    }
    // "/" is itself behind this guard, so sending a wrong-role user there
    // would redirect to itself forever; the login page is the safe landing.
    if (roles && !roles.includes(user.role)) {
      router.replace(redirectTo);
    }
  }, [loading, user, roles, router, pathname, redirectTo]);

  if (loading || !allowed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner className="size-6 text-blue-400" />
      </div>
    );
  }

  return <>{children}</>;
}
