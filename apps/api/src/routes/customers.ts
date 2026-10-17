import { Router } from "express";
import type { Prisma } from "@prisma/client";
import {
  createCustomerSchema,
  customerQuerySchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type CustomerQuery,
  type UpdateCustomerInput,
} from "@finder/shared";
import { prisma } from "../lib/prisma";
import { created, ok, paginated } from "../lib/respond";
import { parsedQuery, validateBody, validateQuery } from "../middleware/validate";
import { requireAuth, requireVendor, vendorIdOf } from "../middleware/auth";
import { notFound } from "../lib/errors";
import { decimalToNumber } from "../lib/serialize";
import { orderInclude, serializeOrder } from "../services/order.service";

const router = Router();

router.use(requireAuth, requireVendor);

/** A customer counts as active if they ordered in the last 90 days. */
const ACTIVE_WINDOW_MS = 90 * 24 * 3_600_000;

async function withActivity(vendorId: string, customerIds: string[]) {
  if (customerIds.length === 0) return new Map<string, Date>();
  const rows = await prisma.order.groupBy({
    by: ["customerId"],
    where: { vendorId, customerId: { in: customerIds } },
    _max: { placedAt: true },
  });
  return new Map(
    rows
      .filter((r) => r.customerId && r._max.placedAt)
      .map((r) => [r.customerId as string, r._max.placedAt as Date]),
  );
}

function serializeCustomer(
  c: Prisma.CustomerGetPayload<object>,
  lastOrderAt: Date | undefined,
) {
  return {
    id: c.id,
    fullName: c.fullName,
    email: c.email,
    phone: c.phone,
    company: c.company,
    notes: c.notes,
    totalOrders: c.totalOrders,
    totalSpent: decimalToNumber(c.totalSpent),
    lastOrderAt: lastOrderAt?.toISOString() ?? null,
    active: lastOrderAt ? Date.now() - lastOrderAt.getTime() < ACTIVE_WINDOW_MS : false,
    repeat: c.totalOrders > 1,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/summary", async (req, res) => {
  const vendorId = vendorIdOf(req);
  const since = new Date(Date.now() - ACTIVE_WINDOW_MS);

  const [total, repeat, orders, active] = await Promise.all([
    prisma.customer.count({ where: { vendorId } }),
    prisma.customer.count({ where: { vendorId, totalOrders: { gt: 1 } } }),
    prisma.customer.aggregate({ where: { vendorId }, _sum: { totalOrders: true } }),
    prisma.order.findMany({
      where: { vendorId, placedAt: { gte: since }, customerId: { not: null } },
      distinct: ["customerId"],
      select: { customerId: true },
    }),
  ]);

  return ok(res, {
    total,
    active: active.length,
    repeat,
    totalOrders: orders._sum.totalOrders ?? 0,
  });
});

router.get("/", validateQuery(customerQuerySchema), async (req, res) => {
  const vendorId = vendorIdOf(req);
  const { page, limit, q } = parsedQuery<CustomerQuery>(req);

  const where: Prisma.CustomerWhereInput = {
    vendorId,
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: [{ totalSpent: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.customer.count({ where }),
  ]);

  const activity = await withActivity(vendorId, rows.map((r) => r.id));
  return paginated(
    res,
    rows.map((r) => serializeCustomer(r, activity.get(r.id))),
    { page, limit, total },
  );
});

router.get("/:id", async (req, res) => {
  const vendorId = vendorIdOf(req);
  const customer = await prisma.customer.findFirst({
    where: { id: req.params.id, vendorId },
  });
  if (!customer) throw notFound("No such customer");

  const orders = await prisma.order.findMany({
    where: { vendorId, customerId: customer.id },
    include: orderInclude,
    orderBy: { placedAt: "desc" },
    take: 10,
  });

  return ok(res, {
    ...serializeCustomer(customer, orders[0]?.placedAt),
    recentOrders: orders.map(serializeOrder),
  });
});

router.post("/", validateBody(createCustomerSchema), async (req, res) => {
  const input = req.body as CreateCustomerInput;
  const customer = await prisma.customer.create({
    data: {
      vendorId: vendorIdOf(req),
      fullName: input.fullName,
      email: input.email?.toLowerCase() ?? null,
      phone: input.phone ?? null,
      company: input.company ?? null,
      notes: input.notes ?? null,
    },
  });
  return created(res, serializeCustomer(customer, undefined));
});

router.patch("/:id", validateBody(updateCustomerSchema), async (req, res) => {
  const vendorId = vendorIdOf(req);
  const existing = await prisma.customer.findFirst({
    where: { id: req.params.id, vendorId },
    select: { id: true },
  });
  if (!existing) throw notFound("No such customer");

  const input = req.body as UpdateCustomerInput;
  const customer = await prisma.customer.update({
    where: { id: existing.id },
    data: {
      fullName: input.fullName,
      email: input.email === undefined ? undefined : input.email?.toLowerCase() ?? null,
      phone: input.phone,
      company: input.company,
      notes: input.notes,
    },
  });
  const activity = await withActivity(vendorId, [customer.id]);
  return ok(res, serializeCustomer(customer, activity.get(customer.id)));
});

export default router;
