import { Router } from "express";
import { z } from "zod";
import {
  paginationQuerySchema,
  partnerStatusSchema,
  recordPayoutSchema,
  vendorStatusUpdateSchema,
  type RecordPayoutInput,
} from "@finder/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { created, ok, paginated } from "../lib/respond";
import { adminBalances, listPayouts, recordPayout, vendorBalances } from "../services/payout.service";
import {
  parsedQuery,
  validateBody,
  validateQuery,
} from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/auth";
import { decimalToNumber } from "../lib/serialize";
import { convertReferral } from "../services/affiliate.service";
import { badRequest, notFound } from "../lib/errors";

const router = Router();

// The whole console is admin-only; the guard in apps/admin only decides what
// gets rendered, this is what actually enforces it.
router.use(requireAuth, requireRole("ADMIN"));

/** Writes an audit row for every state change an operator makes. */
async function audit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.auditLog.create({
    data: { actorId, action, entityType, entityId, metadata },
  });
}

router.get("/stats", async (_req, res) => {
  const [
    totalUsers,
    totalVendors,
    pendingVendors,
    verifiedVendors,
    inventoryItems,
    openContact,
    openPartners,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.vendor.count(),
    prisma.vendor.count({ where: { status: "PENDING" } }),
    prisma.vendor.count({ where: { status: "VERIFIED" } }),
    prisma.inventoryItem.count(),
    prisma.contactSubmission.count({ where: { handledAt: null } }),
    prisma.partner.count({ where: { status: "INQUIRY" } }),
  ]);

  return ok(res, {
    totalUsers,
    totalVendors,
    pendingVendors,
    verifiedVendors,
    inventoryItems,
    openContact,
    openPartners,
  });
});

const vendorQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["PENDING", "VERIFIED", "SUSPENDED", "REJECTED"]).optional(),
  q: z.string().max(200).optional(),
});

router.get("/vendors", validateQuery(vendorQuerySchema), async (req, res) => {
  const { page, limit, status, q } = parsedQuery<z.infer<typeof vendorQuerySchema>>(req);

  const where = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { businessName: { contains: q, mode: "insensitive" as const } },
            { contactEmail: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        businessName: true,
        slug: true,
        contactEmail: true,
        contactPhone: true,
        status: true,
        city: true,
        state: true,
        registrationNumber: true,
        createdAt: true,
        verifiedAt: true,
        category: { select: { name: true, slug: true } },
        user: { select: { id: true, fullName: true, email: true } },
        _count: { select: { inventoryItems: true } },
      },
    }),
    prisma.vendor.count({ where }),
  ]);

  return paginated(res, rows, { page, limit, total });
});

router.patch(
  "/vendors/:id/status",
  validateBody(vendorStatusUpdateSchema),
  async (req, res) => {
    const { status, reason } = req.body as { status: string; reason?: string };

    const vendor = await prisma.vendor.update({
      where: { id: req.params.id },
      data: {
        status: status as never,
        verifiedAt: status === "VERIFIED" ? new Date() : null,
        rejectionReason: status === "REJECTED" ? (reason ?? null) : null,
      },
    });

    if (status === "VERIFIED") await convertReferral(vendor.userId);

    await audit(req.auth!.sub, "VENDOR_STATUS_CHANGED", "Vendor", vendor.id, {
      status,
      reason,
    });

    return ok(res, vendor);
  },
);

const userQuerySchema = paginationQuerySchema.extend({
  role: z.enum(["USER", "VENDOR", "ADMIN"]).optional(),
  q: z.string().max(200).optional(),
});

router.get("/users", validateQuery(userQuerySchema), async (req, res) => {
  const { page, limit, role, q } = parsedQuery<z.infer<typeof userQuerySchema>>(req);

  const where = {
    ...(role ? { role } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return paginated(res, rows, { page, limit, total });
});

router.patch(
  "/users/:id/status",
  validateBody(z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) })),
  async (req, res) => {
    const { status } = req.body as { status: "ACTIVE" | "SUSPENDED" };

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status },
      select: { id: true, email: true, status: true },
    });

    // Suspension has to kill live sessions, or the account keeps working until
    // its refresh token expires.
    if (status === "SUSPENDED") {
      await prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await audit(req.auth!.sub, "USER_STATUS_CHANGED", "User", user.id, { status });
    return ok(res, user);
  },
);

router.get(
  "/contact-submissions",
  validateQuery(paginationQuerySchema),
  async (req, res) => {
    const { page, limit } = parsedQuery<{ page: number; limit: number }>(req);

    const [rows, total] = await Promise.all([
      prisma.contactSubmission.findMany({
        orderBy: [{ handledAt: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contactSubmission.count(),
    ]);

    return paginated(res, rows, { page, limit, total });
  },
);

router.patch("/contact-submissions/:id/handled", async (req, res) => {
  const submission = await prisma.contactSubmission.update({
    where: { id: req.params.id },
    data: { handledAt: new Date() },
  });
  await audit(
    req.auth!.sub,
    "CONTACT_HANDLED",
    "ContactSubmission",
    submission.id,
  );
  return ok(res, submission);
});

router.get("/partners", validateQuery(paginationQuerySchema), async (req, res) => {
  const { page, limit } = parsedQuery<{ page: number; limit: number }>(req);

  const [rows, total] = await Promise.all([
    prisma.partner.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.partner.count(),
  ]);

  return paginated(res, rows, { page, limit, total });
});

router.patch(
  "/partners/:id/status",
  validateBody(z.object({ status: partnerStatusSchema })),
  async (req, res) => {
    const partner = await prisma.partner.update({
      where: { id: req.params.id },
      data: { status: req.body.status, reviewedAt: new Date() },
    });
    await audit(req.auth!.sub, "PARTNER_STATUS_CHANGED", "Partner", partner.id, {
      status: req.body.status,
    });
    return ok(res, partner);
  },
);

router.get("/audit-logs", validateQuery(paginationQuerySchema), async (req, res) => {
  const { page, limit } = parsedQuery<{ page: number; limit: number }>(req);

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { actor: { select: { fullName: true, email: true } } },
    }),
    prisma.auditLog.count(),
  ]);

  return paginated(res, rows, { page, limit, total });
});

// ---------------------------------------------------------------------------
// Affiliates. There is no subscription billing yet, so commission is credited
// by an operator; the tier rate on each affiliate is what billing will apply.
// ---------------------------------------------------------------------------

router.get("/affiliates", async (_req, res) => {
  const rows = await prisma.affiliate.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { fullName: true, email: true } },
      _count: { select: { referrals: true } },
      payouts: { where: { status: "PENDING" }, orderBy: { requestedAt: "asc" } },
    },
  });
  const converted = await prisma.affiliateReferral.groupBy({
    by: ["affiliateId"],
    where: { converted: true },
    _count: { _all: true },
  });
  const convertedBy = new Map(converted.map((c) => [c.affiliateId, c._count._all]));

  return ok(
    res,
    rows.map((a) => ({
      id: a.id,
      code: a.code,
      status: a.status,
      name: a.user.fullName,
      email: a.user.email,
      payoutEmail: a.payoutEmail,
      clicks: a.clickCount,
      referrals: a._count.referrals,
      converted: convertedBy.get(a.id) ?? 0,
      commissionRate: decimalToNumber(a.commissionRate),
      balance: decimalToNumber(a.balance),
      totalEarned: decimalToNumber(a.totalEarned),
      pendingPayouts: a.payouts.map((p) => ({
        id: p.id,
        amount: decimalToNumber(p.amount),
        method: p.method,
        requestedAt: p.requestedAt.toISOString(),
      })),
      createdAt: a.createdAt.toISOString(),
    })),
  );
});

router.patch(
  "/affiliates/:id/status",
  validateBody(z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) })),
  async (req, res) => {
    const affiliate = await prisma.affiliate.update({
      where: { id: req.params.id },
      data: { status: req.body.status },
      select: { id: true, status: true },
    });
    await audit(req.auth!.sub, "AFFILIATE_STATUS_CHANGED", "Affiliate", affiliate.id, {
      status: req.body.status,
    });
    return ok(res, affiliate);
  },
);

router.post(
  "/affiliates/:id/credit",
  validateBody(z.object({ amount: z.coerce.number().positive().max(100_000_000), note: z.string().max(300).optional() })),
  async (req, res) => {
    const { amount, note } = req.body as { amount: number; note?: string };
    const affiliate = await prisma.affiliate.update({
      where: { id: req.params.id },
      data: { balance: { increment: amount }, totalEarned: { increment: amount } },
      select: { id: true, balance: true, totalEarned: true },
    });
    await audit(req.auth!.sub, "AFFILIATE_CREDITED", "Affiliate", affiliate.id, {
      amount,
      note: note ?? null,
    });
    return ok(res, {
      id: affiliate.id,
      balance: decimalToNumber(affiliate.balance),
      totalEarned: decimalToNumber(affiliate.totalEarned),
    });
  },
);

/** Settling a payout: PAID debits the balance, FAILED releases the hold. */
router.patch(
  "/payouts/:id",
  validateBody(z.object({ status: z.enum(["PAID", "FAILED"]), reference: z.string().max(120).optional() })),
  async (req, res) => {
    const { status, reference } = req.body as { status: "PAID" | "FAILED"; reference?: string };

    const payout = await prisma.$transaction(async (tx) => {
      const current = await tx.affiliatePayout.findUnique({ where: { id: req.params.id } });
      if (!current) throw notFound("No such payout");
      if (current.status !== "PENDING") throw badRequest(`This payout is already ${current.status.toLowerCase()}`);

      if (status === "PAID") {
        await tx.affiliate.update({
          where: { id: current.affiliateId },
          data: { balance: { decrement: current.amount } },
        });
      }
      return tx.affiliatePayout.update({
        where: { id: current.id },
        data: { status, reference: reference ?? null, paidAt: status === "PAID" ? new Date() : null },
      });
    });

    await audit(req.auth!.sub, "PAYOUT_SETTLED", "AffiliatePayout", payout.id, {
      status,
      reference: reference ?? null,
    });
    return ok(res, { id: payout.id, status: payout.status });
  },
);

/** What Finder holds for each vendor from Buy now orders, and what it has paid out. */
router.get("/vendor-payouts", async (_req, res) => ok(res, await adminBalances()));

router.get("/vendors/:id/payouts", async (req, res) => {
  const vendorId = req.params.id!;
  const [balances, payouts] = await Promise.all([vendorBalances(vendorId), listPayouts(vendorId)]);
  return ok(res, { balances, payouts });
});

/** Records a manual bank transfer to a vendor; never more than is owed. */
router.post("/vendors/:id/payouts", validateBody(recordPayoutSchema), async (req, res) => {
  const payout = await recordPayout(req.auth!.sub, req.params.id!, req.body as RecordPayoutInput);
  await audit(req.auth!.sub, "VENDOR_PAYOUT_RECORDED", "Vendor", req.params.id!, {
    payoutId: payout.id,
    amount: payout.amount,
    currency: payout.currency,
    reference: payout.reference,
  });
  return created(res, payout);
});

/** Highest-value inventory on the platform — a quick sanity read for ops. */
router.get("/inventory/top", async (_req, res) => {
  const rows = await prisma.inventoryItem.findMany({
    orderBy: { quantity: "desc" },
    take: 10,
    select: {
      id: true,
      name: true,
      quantity: true,
      unit: true,
      price: true,
      status: true,
      vendor: { select: { businessName: true, slug: true } },
    },
  });

  return ok(
    res,
    rows.map((row) => ({ ...row, price: decimalToNumber(row.price) })),
  );
});

export default router;
