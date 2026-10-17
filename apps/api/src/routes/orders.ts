import { Router } from "express";
import type { Prisma } from "@prisma/client";
import {
  createOrderSchema,
  orderQuerySchema,
  updateOrderStatusSchema,
  type CreateOrderInput,
  type OrderQuery,
  type UpdateOrderStatusInput,
} from "@finder/shared";
import { prisma } from "../lib/prisma";
import { created, ok, paginated } from "../lib/respond";
import { parsedQuery, validateBody, validateQuery } from "../middleware/validate";
import { requireAuth, requireVendor, vendorIdOf } from "../middleware/auth";
import { notFound } from "../lib/errors";
import { decimalToNumber } from "../lib/serialize";
import {
  createOrder,
  orderInclude,
  serializeOrder,
  transitionOrder,
} from "../services/order.service";

const router = Router();

router.use(requireAuth, requireVendor);

/** Count per status plus revenue — drives the stat row and tab badges. */
router.get("/summary", async (req, res) => {
  const vendorId = vendorIdOf(req);

  const [byStatus, fulfilled] = await Promise.all([
    prisma.order.groupBy({
      by: ["status"],
      where: { vendorId },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: { vendorId, status: "FULFILLED" },
      _sum: { total: true },
    }),
  ]);

  const counts = Object.fromEntries(
    byStatus.map((row) => [row.status, row._count._all]),
  ) as Record<string, number>;

  return ok(res, {
    total: byStatus.reduce((sum, row) => sum + row._count._all, 0),
    pending: counts.PENDING ?? 0,
    processing: (counts.CONFIRMED ?? 0) + (counts.PROCESSING ?? 0),
    fulfilled: counts.FULFILLED ?? 0,
    cancelled: (counts.CANCELLED ?? 0) + (counts.REFUNDED ?? 0),
    revenue: decimalToNumber(fulfilled._sum.total),
    // Money the vendor is owed on orders still in flight.
    openValue: byStatus
      .filter((row) => ["PENDING", "CONFIRMED", "PROCESSING"].includes(row.status))
      .reduce((sum, row) => sum + decimalToNumber(row._sum.total), 0),
  });
});

router.get("/", validateQuery(orderQuerySchema), async (req, res) => {
  const vendorId = vendorIdOf(req);
  const { page, limit, q, status, from, to } = parsedQuery<OrderQuery>(req);

  const where: Prisma.OrderWhereInput = {
    vendorId,
    ...(status ? { status } : {}),
    ...(from || to
      ? {
          placedAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: "insensitive" } },
            { customer: { fullName: { contains: q, mode: "insensitive" } } },
            { customer: { company: { contains: q, mode: "insensitive" } } },
            { items: { some: { name: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

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

router.get("/:id", async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, vendorId: vendorIdOf(req) },
    include: orderInclude,
  });
  if (!order) throw notFound("No such order");
  return ok(res, serializeOrder(order));
});

router.post("/", validateBody(createOrderSchema), async (req, res) => {
  const order = await createOrder(vendorIdOf(req), req.body as CreateOrderInput);
  return created(res, serializeOrder(order));
});

router.patch(
  "/:id/status",
  validateBody(updateOrderStatusSchema),
  async (req, res) => {
    const { status, note } = req.body as UpdateOrderStatusInput;
    const order = await transitionOrder(vendorIdOf(req), req.params.id!, status, note);
    return ok(res, serializeOrder(order));
  },
);

export default router;
