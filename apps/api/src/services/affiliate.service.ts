import crypto from "crypto";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { env } from "../env";

export const REF_COOKIE = "finder_ref";
/** The affiliate page promises 90-day attribution. */
export const REF_COOKIE_MAX_AGE_MS = 90 * 24 * 3_600_000;

/**
 * Tiers from the public /affiliate page, keyed on converted referrals. The
 * rate is stored on the affiliate so billing can apply it once subscriptions
 * exist; until then commission is credited by an operator.
 */
export const TIERS = [
  { name: "Starter", min: 0, rate: 0.08 },
  { name: "Growth", min: 6, rate: 0.12 },
  { name: "Elite", min: 21, rate: 0.18 },
  { name: "Enterprise", min: 51, rate: 0.18 },
] as const;

export function tierFor(converted: number) {
  let tier: (typeof TIERS)[number] = TIERS[0];
  for (const t of TIERS) if (converted >= t.min) tier = t;
  const next = TIERS[TIERS.indexOf(tier) + 1] ?? null;
  return {
    name: tier.name,
    rate: tier.rate,
    next: next ? { name: next.name, needed: next.min - converted } : null,
  };
}

export function newAffiliateCode(): string {
  return `AFF${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

export function referralLink(code: string): string {
  return `${env.webUrl}/r/${code}`;
}

/**
 * Credits a fresh signup to whoever referred it, if the browser carries a
 * valid finder_ref cookie (set by the web app's /r/[code] route and forwarded
 * by the BFF proxy). Never blocks or fails a registration.
 */
export async function attributeSignup(
  req: Request,
  res: Response,
  userId: string,
  referredType: "USER" | "VENDOR",
): Promise<void> {
  const code = req.cookies?.[REF_COOKIE];
  if (typeof code !== "string" || !code) return;

  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { code },
      select: { id: true, userId: true, status: true },
    });
    // No self-referral, and suspended affiliates earn nothing new.
    if (!affiliate || affiliate.status !== "ACTIVE" || affiliate.userId === userId) return;

    await prisma.affiliateReferral.create({
      data: { affiliateId: affiliate.id, referredType, referredId: userId },
    });
    res.clearCookie(REF_COOKIE, { path: "/" });
  } catch (err) {
    logger.warn(`referral attribution failed: ${String(err)}`);
  }
}

/**
 * Marks a referral converted: a USER when they verify their email, a VENDOR
 * when an operator verifies the business. Idempotent.
 */
export async function convertReferral(referredId: string): Promise<void> {
  try {
    const referral = await prisma.affiliateReferral.findFirst({
      where: { referredId, converted: false },
      select: { id: true, affiliateId: true },
    });
    if (!referral) return;

    await prisma.affiliateReferral.update({
      where: { id: referral.id },
      data: { converted: true, convertedAt: new Date() },
    });

    // Re-rate the affiliate as conversions move them up a tier.
    const converted = await prisma.affiliateReferral.count({
      where: { affiliateId: referral.affiliateId, converted: true },
    });
    await prisma.affiliate.update({
      where: { id: referral.affiliateId },
      data: { commissionRate: tierFor(converted).rate },
    });
  } catch (err) {
    logger.warn(`referral conversion failed: ${String(err)}`);
  }
}
