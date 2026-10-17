import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  createInventoryItemSchema,
  discoverQuerySchema,
  updateInventoryItemSchema,
  type CreateInventoryItemInput,
  type UpdateInventoryItemInput,
  inventoryQuerySchema,
  inventorySyncSchema,
  orderQuerySchema,
  type DiscoverQuery,
  type InventoryQuery,
  type InventorySyncInput,
  type OrderQuery,
} from "@finder/shared";
import { prisma } from "../lib/prisma";
import { created, noContent, ok, paginated } from "../lib/respond";
import { z } from "zod";
import { badRequest } from "../lib/errors";
import { parsedQuery, validateBody, validateQuery } from "../middleware/validate";
import { requireApiKey, requireScope } from "../middleware/api-key";
import { runDiscover } from "../services/discover.service";
import {
  createInventoryItem,
  deleteInventoryItem,
  findOwnItem,
  inventoryInclude,
  serializeInventoryItem,
  syncInventory,
  updateInventoryItem,
} from "../services/inventory.service";
import { orderInclude, serializeOrder } from "../services/order.service";

/**
 * The key-authenticated public API documented on /developers:
 *   GET    /search, /search/nearby, /search/suggestions      SEARCH_READ
 *   GET    /inventory, /inventory/:id, /inventory/history    INVENTORY_READ
 *   POST   /inventory, /inventory/sync (alias /inventory/bulk) INVENTORY_WRITE
 *   PATCH  /inventory/:id, DELETE /inventory/:id               INVENTORY_WRITE
 *   GET    /orders                                            ORDERS_READ
 * (all under /api/v1)
 * Every call acts as the vendor that owns the key.
 */
const router = Router();

router.use(requireApiKey);

// Per key rather than per IP: integrations often share egress addresses.
router.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => req.apiKey!.id,
    message: {
      ok: false,
      error: { code: "TOO_MANY_REQUESTS", message: "Rate limit: 120 requests per minute per key" },
    },
  }),
);

router.get("/search", requireScope("SEARCH_READ"), validateQuery(discoverQuerySchema), async (req, res) => {
  const { rows, meta } = await runDiscover(parsedQuery<DiscoverQuery>(req), null);
  return paginated(res, rows, meta);
});

/** Same as /search, but a location is required and results are nearest first. */
router.get("/search/nearby", requireScope("SEARCH_READ"), validateQuery(discoverQuerySchema), async (req, res) => {
  const query = parsedQuery<DiscoverQuery>(req);
  if (query.latitude === undefined || query.longitude === undefined) {
    throw badRequest("latitude and longitude are required");
  }
  const { rows, meta } = await runDiscover({ ...query, sort: "distance" }, null);
  return paginated(res, rows, meta);
});

/** Autocomplete: distinct listed product names starting with q, verified vendors only. */
router.get(
  "/search/suggestions",
  requireScope("SEARCH_READ"),
  validateQuery(z.object({ q: z.string().min(1).max(100), limit: z.coerce.number().int().min(1).max(20).default(8) })),
  async (req, res) => {
    const { q, limit } = parsedQuery<{ q: string; limit: number }>(req);
    const rows = await prisma.inventoryItem.findMany({
      where: {
        name: { startsWith: q, mode: "insensitive" },
        status: { not: "DISCONTINUED" },
        vendor: { status: "VERIFIED", listingPaused: false },
      },
      distinct: ["name"],
      select: { name: true },
      orderBy: { name: "asc" },
      take: limit,
    });
    return ok(res, rows.map((r) => r.name));
  },
);

/** Recent sync runs for this vendor — the stock change audit trail. */
router.get("/inventory/history", requireScope("INVENTORY_READ"), async (req, res) => {
  const jobs = await prisma.inventorySyncJob.findMany({
    where: { vendorId: req.apiKey!.vendorId },
    orderBy: { startedAt: "desc" },
    take: 50,
  });
  return ok(res, jobs);
});

router.get("/inventory", requireScope("INVENTORY_READ"), validateQuery(inventoryQuerySchema), async (req, res) => {
  const { page, limit, status, sort, order } = parsedQuery<InventoryQuery>(req);
  const where = { vendorId: req.apiKey!.vendorId, ...(status ? { status } : {}) };
  const [rows, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      include: inventoryInclude,
      orderBy: { [sort]: order },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.inventoryItem.count({ where }),
  ]);
  return paginated(res, rows.map(serializeInventoryItem), { page, limit, total });
});

const syncHandler = async (req: import("express").Request, res: import("express").Response) => {
  const { items } = req.body as InventorySyncInput;
  return ok(res, await syncInventory(req.apiKey!.vendorId, items, "API"));
};
router.post("/inventory/sync", requireScope("INVENTORY_WRITE"), validateBody(inventorySyncSchema), syncHandler);
router.post("/inventory/bulk", requireScope("INVENTORY_WRITE"), validateBody(inventorySyncSchema), syncHandler);

router.get("/inventory/:id", requireScope("INVENTORY_READ"), async (req, res) => {
  return ok(res, serializeInventoryItem(await findOwnItem(req.apiKey!.vendorId, req.params.id!)));
});

router.post("/inventory", requireScope("INVENTORY_WRITE"), validateBody(createInventoryItemSchema), async (req, res) => {
  return created(res, await createInventoryItem(req.apiKey!.vendorId, req.body as CreateInventoryItemInput, req.rawBody ?? {}));
});

router.patch("/inventory/:id", requireScope("INVENTORY_WRITE"), validateBody(updateInventoryItemSchema), async (req, res) => {
  return ok(res, await updateInventoryItem(req.apiKey!.vendorId, req.params.id!, req.body as UpdateInventoryItemInput));
});

router.delete("/inventory/:id", requireScope("INVENTORY_WRITE"), async (req, res) => {
  await deleteInventoryItem(req.apiKey!.vendorId, req.params.id!);
  return noContent(res);
});

router.get("/orders", requireScope("ORDERS_READ"), validateQuery(orderQuerySchema), async (req, res) => {
  const { page, limit, status } = parsedQuery<OrderQuery>(req);
  const where = { vendorId: req.apiKey!.vendorId, ...(status ? { status } : {}) };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { placedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);
  return paginated(res, rows.map(serializeOrder), { page, limit, total });
});

export default router;
