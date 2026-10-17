import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  affiliateApplicationSchema,
  payoutRequestSchema,
  type AffiliateApplicationInput,
  type PayoutRequestInput,
} from "@finder/shared";
import { prisma } from "../lib/prisma";
import { created, ok } from "../lib/respond";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { decimalToNumber, toIso } from "../lib/serialize";
import { newAffiliateCode, referralLink, tierFor } from "../services/affiliate.service";

const router = Router();

/**
 * Public: the web app's /r/[code] route calls this to count a click and
 * confirm the code before setting the attribution cookie.
 */
router.post(
  "/click/:code",
  rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false }),
  async (req, res) => {
    const affiliate = await prisma.affiliate.findUnique({
      where: { code: req.params.code },
      select: { id: true, status: true },
    });
    if (!affiliate || affiliate.status !== "ACTIVE") throw notFound("Unknown referral code");
    await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: { clickCount: { increment: 1 } },
    });
    return ok(res, { valid: true });
  },
);

router.use(requireAuth);

/** Resolves the caller's affiliate record, or null if they never joined. */
async function mine(userId: string) {
  return prisma.affiliate.findUnique({ where: { userId } });
}

router.get("/me", async (req, res) => {
  const affiliate = await mine(req.auth!.sub);
  if (!affiliate) return ok(res, { affiliate: null });

  const [referrals, payouts] = await Promise.all([
    prisma.affiliateReferral.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.affiliatePayout.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { requestedAt: "desc" },
      take: 20,
    }),
  ]);

  // Names for the referral table; referredId is always a user id.
  const users = await prisma.user.findMany({
    where: { id: { in: referrals.map((r) => r.referredId) } },
    select: { id: true, fullName: true, vendor: { select: { businessName: true, status: true } } },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  const converted = referrals.filter((r) => r.converted).length;
  const pendingPayout = payouts
    .filter((p) => p.status === "PENDING")
    .reduce((s, p) => s + decimalToNumber(p.amount), 0);

  // Earnings per month over the last six months, from converted commissions.
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 4 + i, 1));
    return { start, end, name: start.toLocaleString("en", { month: "short", timeZone: "UTC" }) };
  });
  const earnings = months.map(({ start, end, name }) => ({
    name,
    earnings: referrals
      .filter((r) => r.convertedAt && r.convertedAt >= start && r.convertedAt < end)
      .reduce((s, r) => s + decimalToNumber(r.commission), 0),
  }));

  return ok(res, {
    affiliate: {
      id: affiliate.id,
      code: affiliate.code,
      status: affiliate.status,
      link: referralLink(affiliate.code),
      payoutEmail: affiliate.payoutEmail,
      commissionRate: decimalToNumber(affiliate.commissionRate),
      balance: decimalToNumber(affiliate.balance),
      available: Math.max(0, decimalToNumber(affiliate.balance) - pendingPayout),
      totalEarned: decimalToNumber(affiliate.totalEarned),
      clicks: affiliate.clickCount,
      createdAt: affiliate.createdAt.toISOString(),
    },
    tier: tierFor(converted),
    stats: {
      signups: referrals.length,
      converted,
      pending: referrals.length - converted,
      conversionRate:
        affiliate.clickCount > 0
          ? Math.round((referrals.length / affiliate.clickCount) * 1000) / 10
          : 0,
    },
    earnings,
    referrals: referrals.map((r) => {
      const user = byId.get(r.referredId);
      return {
        id: r.id,
        name: user?.vendor?.businessName ?? user?.fullName ?? "Deleted account",
        type: r.referredType === "VENDOR" ? "Vendor" : "User",
        status: r.converted ? "Active" : "Pending",
        joined: r.createdAt.toISOString(),
        commission: decimalToNumber(r.commission),
      };
    }),
    payouts: payouts.map((p) => ({
      id: p.id,
      amount: decimalToNumber(p.amount),
      currency: p.currency,
      method: p.method,
      status: p.status,
      reference: p.reference,
      requestedAt: p.requestedAt.toISOString(),
      paidAt: toIso(p.paidAt),
    })),
  });
});

/** Joining is instant — the public page promises "no approval wait". */
router.post("/apply", validateBody(affiliateApplicationSchema), async (req, res) => {
  const userId = req.auth!.sub;
  if (await mine(userId)) throw conflict("You are already a Finder affiliate");

  const input = req.body as AffiliateApplicationInput;
  const affiliate = await prisma.affiliate.create({
    data: {
      userId,
      code: newAffiliateCode(),
      status: "ACTIVE",
      approvedAt: new Date(),
      payoutEmail: input.payoutEmail.toLowerCase(),
      website: input.website || null,
      audienceDescription: input.audienceDescription,
      promotionChannels: input.promotionChannels,
      commissionRate: tierFor(0).rate,
    },
  });

  return created(res, { code: affiliate.code, link: referralLink(affiliate.code) });
});

const MIN_PAYOUT = 5_000;

router.post("/payouts", validateBody(payoutRequestSchema), async (req, res) => {
  const affiliate = await mine(req.auth!.sub);
  if (!affiliate) throw notFound("Join the affiliate programme first");
  if (affiliate.status !== "ACTIVE") throw forbidden("Your affiliate account is not active");

  const { amount, method } = req.body as PayoutRequestInput;
  if (amount < MIN_PAYOUT) throw badRequest(`The minimum withdrawal is ₦${MIN_PAYOUT.toLocaleString()}`);

  // Balance only drops when an operator marks the payout paid, so anything
  // already requested is held back from what can be requested now.
  const pending = await prisma.affiliatePayout.aggregate({
    where: { affiliateId: affiliate.id, status: "PENDING" },
    _sum: { amount: true },
  });
  const available = decimalToNumber(affiliate.balance) - decimalToNumber(pending._sum.amount);
  if (amount > available) {
    throw badRequest(`You can withdraw up to ₦${Math.max(0, available).toLocaleString()}`);
  }

  const payout = await prisma.affiliatePayout.create({
    data: { affiliateId: affiliate.id, amount, method },
  });
  return created(res, { id: payout.id, status: payout.status });
});

export default router;
