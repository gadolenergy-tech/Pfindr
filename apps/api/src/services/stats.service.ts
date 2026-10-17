import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

/** Midnight UTC today — the key for VendorDailyStat rows. */
function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Counts one search impression per vendor in a result set. Fire-and-forget:
 * callers never await it, and a failure is logged rather than surfaced, so
 * analytics can never break a search.
 */
export function recordImpressions(vendorIds: string[]): void {
  const unique = [...new Set(vendorIds)];
  if (unique.length === 0) return;
  const day = today();

  void Promise.all(
    unique.map((vendorId) =>
      prisma.vendorDailyStat.upsert({
        where: { vendorId_day: { vendorId, day } },
        create: { vendorId, day, impressions: 1 },
        update: { impressions: { increment: 1 } },
      }),
    ),
  ).catch((err: unknown) => logger.warn(`impression log failed: ${String(err)}`));
}

export function recordProfileView(vendorId: string): void {
  const day = today();
  void prisma.vendorDailyStat
    .upsert({
      where: { vendorId_day: { vendorId, day } },
      create: { vendorId, day, profileViews: 1 },
      update: { profileViews: { increment: 1 } },
    })
    .catch((err: unknown) => logger.warn(`profile view log failed: ${String(err)}`));
}
