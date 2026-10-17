import { Router } from "express";
import { discoverQuerySchema, type DiscoverQuery } from "@finder/shared";
import { prisma } from "../lib/prisma";
import { ok, paginated } from "../lib/respond";
import { parsedQuery, validateQuery } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { runDiscover } from "../services/discover.service";

const router = Router();

/**
 * The discovery query: what is in stock, how much, at what price, and from
 * the nearest verified vendor. Requires a signed-in caller — the search bar
 * and its trending ticker are gated behind login. Logic lives in
 * services/discover.service.ts, shared with the key-authenticated GET /v1/search.
 */
router.get("/discover", requireAuth, validateQuery(discoverQuerySchema), async (req, res) => {
  const { rows, meta } = await runDiscover(parsedQuery<DiscoverQuery>(req), req.auth?.sub ?? null);
  return paginated(res, rows, meta);
});

/** Most-searched terms over the last 7 days — feeds the live ticker. */
router.get("/discover/trending", requireAuth, async (_req, res) => {
  const since = new Date(Date.now() - 7 * 24 * 3_600_000);
  const rows = await prisma.searchQuery.groupBy({
    by: ["term"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { term: "desc" } },
    take: 10,
  });
  return ok(
    res,
    rows.map((r) => ({ term: r.term, searches: r._count._all })),
  );
});

export default router;
