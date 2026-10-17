import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ok } from "../lib/respond";
import { parsedQuery, validateQuery } from "../middleware/validate";
import { requireAuth, requireVendor, vendorIdOf } from "../middleware/auth";
import { decimalToNumber } from "../lib/serialize";

/**
 * Vendor analytics, computed from real rows:
 *   revenue / orders  ← Order (FULFILLED counts as revenue, everything but
 *                        CANCELLED/REFUNDED counts as an order received)
 *   views             ← VendorDailyStat.impressions (search appearances)
 *   profileViews      ← VendorDailyStat.profileViews
 * Every KPI carries a trend against the equal-length window just before it.
 */
const router = Router();

router.use(requireAuth, requireVendor);

type Period = "daily" | "weekly" | "monthly";

const querySchema = z.object({
  period: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
});

const DAY = 86_400_000;

/** Bucket boundaries, oldest first: 7 days, 4 weeks or 6 months. */
function buckets(period: Period): { start: Date; end: Date; label: string }[] {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const out: { start: Date; end: Date; label: string }[] = [];

  if (period === "daily") {
    const fmt = new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" });
    for (let i = 6; i >= 0; i--) {
      const start = new Date(todayUtc - i * DAY);
      out.push({ start, end: new Date(start.getTime() + DAY), label: fmt.format(start) });
    }
  } else if (period === "weekly") {
    for (let i = 3; i >= 0; i--) {
      const end = new Date(todayUtc + DAY - i * 7 * DAY);
      out.push({ start: new Date(end.getTime() - 7 * DAY), end, label: `Wk ${4 - i}` });
    }
  } else {
    const fmt = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });
    for (let i = 5; i >= 0; i--) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
      out.push({ start, end, label: fmt.format(start) });
    }
  }
  return out;
}

/** Percentage change, or null when there is no baseline to compare with. */
function trend(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

async function windowTotals(vendorId: string, start: Date, end: Date) {
  const [orders, revenue, stats] = await Promise.all([
    prisma.order.count({
      where: {
        vendorId,
        placedAt: { gte: start, lt: end },
        status: { notIn: ["CANCELLED", "REFUNDED"] },
      },
    }),
    prisma.order.aggregate({
      where: { vendorId, status: "FULFILLED", placedAt: { gte: start, lt: end } },
      _sum: { total: true },
    }),
    prisma.vendorDailyStat.aggregate({
      where: { vendorId, day: { gte: start, lt: end } },
      _sum: { impressions: true, profileViews: true },
    }),
  ]);
  return {
    orders,
    revenue: decimalToNumber(revenue._sum.total),
    views: stats._sum.impressions ?? 0,
    profileViews: stats._sum.profileViews ?? 0,
  };
}

router.get("/", validateQuery(querySchema), async (req, res) => {
  const vendorId = vendorIdOf(req);
  const { period } = parsedQuery<{ period: Period }>(req);
  const ranges = buckets(period);
  const first = ranges[0]!;
  const last = ranges[ranges.length - 1]!;
  const span = last.end.getTime() - first.start.getTime();

  // Pull every row in the window once, then bucket in memory.
  const [orders, stats, current, previous] = await Promise.all([
    prisma.order.findMany({
      where: { vendorId, placedAt: { gte: first.start, lt: last.end } },
      select: { placedAt: true, status: true, total: true },
    }),
    prisma.vendorDailyStat.findMany({
      where: { vendorId, day: { gte: first.start, lt: last.end } },
      select: { day: true, impressions: true, profileViews: true },
    }),
    windowTotals(vendorId, first.start, last.end),
    windowTotals(vendorId, new Date(first.start.getTime() - span), first.start),
  ]);

  const series = ranges.map(({ start, end, label }) => {
    const inRange = (d: Date) => d >= start && d < end;
    const bucketOrders = orders.filter((o) => inRange(o.placedAt));
    const bucketStats = stats.filter((s) => inRange(s.day));
    return {
      name: label,
      revenue: bucketOrders
        .filter((o) => o.status === "FULFILLED")
        .reduce((sum, o) => sum + decimalToNumber(o.total), 0),
      orders: bucketOrders.filter((o) => o.status !== "CANCELLED" && o.status !== "REFUNDED").length,
      views: bucketStats.reduce((sum, s) => sum + s.impressions, 0),
      profileViews: bucketStats.reduce((sum, s) => sum + s.profileViews, 0),
    };
  });

  const conversion = current.views > 0 ? (current.orders / current.views) * 100 : 0;
  const prevConversion = previous.views > 0 ? (previous.orders / previous.views) * 100 : 0;

  return ok(res, {
    period,
    series,
    kpis: {
      revenue: { value: current.revenue, trend: trend(current.revenue, previous.revenue) },
      orders: { value: current.orders, trend: trend(current.orders, previous.orders) },
      conversion: {
        value: Math.round(conversion * 10) / 10,
        trend: previous.views > 0 ? Math.round((conversion - prevConversion) * 10) / 10 : null,
      },
      views: { value: current.views, trend: trend(current.views, previous.views) },
      profileViews: {
        value: current.profileViews,
        trend: trend(current.profileViews, previous.profileViews),
      },
    },
  });
});

/** Best sellers by units across live and completed orders, all time. */
router.get("/top-products", async (req, res) => {
  const vendorId = vendorIdOf(req);
  const rows = await prisma.orderItem.groupBy({
    by: ["name"],
    where: { order: { vendorId, status: { notIn: ["CANCELLED", "REFUNDED"] } } },
    _sum: { quantity: true, lineTotal: true },
    _count: { _all: true },
    orderBy: { _sum: { lineTotal: "desc" } },
    take: 5,
  });
  return ok(
    res,
    rows.map((r) => ({
      name: r.name,
      orders: r._count._all,
      units: r._sum.quantity ?? 0,
      revenue: decimalToNumber(r._sum.lineTotal),
    })),
  );
});

/** New customers per month for the last six months. */
router.get("/customer-growth", async (req, res) => {
  const vendorId = vendorIdOf(req);
  const ranges = buckets("monthly");
  const customers = await prisma.customer.findMany({
    where: { vendorId, createdAt: { gte: ranges[0]!.start } },
    select: { createdAt: true },
  });
  return ok(
    res,
    ranges.map(({ start, end, label }) => ({
      name: label,
      customers: customers.filter((c) => c.createdAt >= start && c.createdAt < end).length,
    })),
  );
});

/**
 * Plain-rule recommendations for the dashboard — no model behind them, so the
 * copy says what the rule saw rather than claiming insight it does not have.
 */
router.get("/recommendations", async (req, res) => {
  const vendorId = vendorIdOf(req);
  const [lowStock, stale, unread, noSku] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { vendorId, status: { in: ["LOW_STOCK", "OUT_OF_STOCK"] } },
      orderBy: { quantity: "asc" },
      take: 3,
      select: { name: true, quantity: true, unit: true },
    }),
    prisma.inventoryItem.count({
      where: { vendorId, updatedAt: { lt: new Date(Date.now() - 14 * DAY) } },
    }),
    prisma.conversation.aggregate({
      where: { vendorId, archivedAt: null },
      _sum: { vendorUnread: true },
    }),
    prisma.inventoryItem.count({ where: { vendorId, sku: null } }),
  ]);

  const recs: { kind: string; title: string; detail: string; href: string }[] = [];

  if (lowStock.length) {
    const first = lowStock[0]!;
    recs.push({
      kind: "restock",
      title: `Restock ${first.name}`,
      detail:
        first.quantity === 0
          ? "It is out of stock and hidden from search."
          : `Only ${first.quantity} ${first.unit} left${lowStock.length > 1 ? `, plus ${lowStock.length - 1} other low item(s)` : ""}.`,
      href: "/vendor/inventory",
    });
  }
  const pending = unread._sum.vendorUnread ?? 0;
  if (pending) {
    recs.push({
      kind: "reply",
      title: `Reply to ${pending} unread message${pending > 1 ? "s" : ""}`,
      detail: "Quote requests go cold quickly — buyers usually contact several vendors.",
      href: "/vendor/messages",
    });
  }
  if (stale) {
    recs.push({
      kind: "refresh",
      title: `Refresh ${stale} stale listing${stale > 1 ? "s" : ""}`,
      detail: "Not updated in 14 days. Fresh stock ranks higher in search.",
      href: "/vendor/inventory",
    });
  }
  if (noSku) {
    recs.push({
      kind: "sku",
      title: `Add SKUs to ${noSku} product${noSku > 1 ? "s" : ""}`,
      detail: "Bulk import and the sync API match items by SKU.",
      href: "/vendor/inventory",
    });
  }

  return ok(res, recs.slice(0, 3));
});

export default router;
