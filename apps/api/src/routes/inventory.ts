import { Router } from "express";
import type { Prisma } from "@prisma/client";
import {
  createInventoryItemSchema,
  inventoryQuerySchema,
  inventorySyncSchema,
  updateInventoryItemSchema,
  type CreateInventoryItemInput,
  type InventoryQuery,
  type InventorySyncInput,
  type UpdateInventoryItemInput,
} from "@finder/shared";
import { prisma } from "../lib/prisma";
import { created, noContent, ok, paginated } from "../lib/respond";
import { parsedQuery, validateBody, validateQuery } from "../middleware/validate";
import { requireAuth, requireVendor, vendorIdOf } from "../middleware/auth";
import { badRequest } from "../lib/errors";
import { decimalToNumber } from "../lib/serialize";
import {
  createInventoryItem,
  deleteInventoryItem,
  findOwnItem,
  inventoryInclude,
  serializeInventoryItem,
  syncInventory,
  updateInventoryItem,
} from "../services/inventory.service";

const router = Router();

router.use(requireAuth, requireVendor);

/** Headline numbers for the inventory and dashboard pages. */
router.get("/summary", async (req, res) => {
  const vendorId = vendorIdOf(req);

  const [byStatus, totals, lastJob] = await Promise.all([
    prisma.inventoryItem.groupBy({
      by: ["status"],
      where: { vendorId },
      _count: { _all: true },
    }),
    prisma.inventoryItem.aggregate({
      where: { vendorId },
      _sum: { quantity: true },
      _count: { _all: true },
    }),
    prisma.inventorySyncJob.findFirst({
      where: { vendorId },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  // Stock value needs price x quantity per row, which aggregate cannot do.
  const valueRows = await prisma.inventoryItem.findMany({
    where: { vendorId },
    select: { price: true, quantity: true },
  });
  const stockValue = valueRows.reduce(
    (sum, row) => sum + decimalToNumber(row.price) * row.quantity,
    0,
  );

  const counts = Object.fromEntries(
    byStatus.map((row) => [row.status, row._count._all]),
  ) as Record<string, number>;

  return ok(res, {
    totalItems: totals._count._all,
    totalUnits: totals._sum.quantity ?? 0,
    stockValue,
    inStock: counts.IN_STOCK ?? 0,
    lowStock: counts.LOW_STOCK ?? 0,
    outOfStock: counts.OUT_OF_STOCK ?? 0,
    discontinued: counts.DISCONTINUED ?? 0,
    lastSync: lastJob
      ? {
          id: lastJob.id,
          source: lastJob.source,
          startedAt: lastJob.startedAt.toISOString(),
          finishedAt: lastJob.finishedAt?.toISOString() ?? null,
          updated: lastJob.updatedItems,
          created: lastJob.createdItems,
          failed: lastJob.failedItems,
        }
      : null,
  });
});

router.get("/", validateQuery(inventoryQuerySchema), async (req, res) => {
  const vendorId = vendorIdOf(req);
  const { page, limit, q, categoryId, status, sort, order } =
    parsedQuery<InventoryQuery>(req);

  const where: Prisma.InventoryItemWhereInput = {
    vendorId,
    ...(categoryId ? { categoryId } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

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

router.get("/sync-jobs", async (req, res) => {
  const vendorId = vendorIdOf(req);
  const jobs = await prisma.inventorySyncJob.findMany({
    where: { vendorId },
    orderBy: { startedAt: "desc" },
    take: 20,
  });
  return ok(res, jobs);
});

router.get("/:id", async (req, res) => {
  const item = await findOwnItem(vendorIdOf(req), req.params.id!);
  return ok(res, serializeInventoryItem(item));
});

router.post("/", validateBody(createInventoryItemSchema), async (req, res) => {
  const item = await createInventoryItem(vendorIdOf(req), req.body as CreateInventoryItemInput, req.rawBody ?? {});
  return created(res, item);
});

router.patch("/:id", validateBody(updateInventoryItemSchema), async (req, res) => {
  const item = await updateInventoryItem(vendorIdOf(req), req.params.id!, req.body as UpdateInventoryItemInput);
  return ok(res, item);
});

router.delete("/:id", async (req, res) => {
  await deleteInventoryItem(vendorIdOf(req), req.params.id!);
  return noContent(res);
});

/**
 * Deletes every item the vendor has listed. Requires ?confirm=all so a stray
 * DELETE on the collection cannot wipe a catalogue.
 */
router.delete("/", async (req, res) => {
  if (req.query.confirm !== "all") {
    throw badRequest("Pass ?confirm=all to delete your whole inventory");
  }
  const { count } = await prisma.inventoryItem.deleteMany({
    where: { vendorId: vendorIdOf(req) },
  });
  return ok(res, { deleted: count });
});

/** Spreadsheet import from the dashboard. The API-key route shares the service. */
router.post("/sync", validateBody(inventorySyncSchema), async (req, res) => {
  const { items } = req.body as InventorySyncInput;
  const result = await syncInventory(vendorIdOf(req), items, "BULK_IMPORT");
  return ok(res, result);
});

export default router;
