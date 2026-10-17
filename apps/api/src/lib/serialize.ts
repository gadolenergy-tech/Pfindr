import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@finder/shared";

/**
 * Prisma returns Decimal and Date objects that do not survive JSON in a useful
 * shape. Everything crossing the wire goes through here first: Decimal becomes
 * a number, Date becomes an ISO string.
 */
export function decimalToNumber(
  value: Prisma.Decimal | number | null | undefined,
): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}

export function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

type UserRow = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: SessionUser["role"];
  emailVerified: boolean;
  avatarUrl: string | null;
  createdAt: Date;
};

export function toSessionUser(
  user: UserRow,
  vendorId: string | null,
): SessionUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    emailVerified: user.emailVerified,
    avatarUrl: user.avatarUrl,
    vendorId,
    createdAt: user.createdAt.toISOString(),
  };
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}
