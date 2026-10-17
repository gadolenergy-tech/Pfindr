import crypto from "crypto";
import type { Request } from "express";
import type { SessionUser } from "@finder/shared";
import { prisma } from "../lib/prisma";
import { env } from "../env";
import { logger } from "../lib/logger";
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
  ttlToMs,
} from "../lib/jwt";
import { toSessionUser } from "../lib/serialize";
import { conflict, unauthorized } from "../lib/errors";

export type IssuedSession = {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
};

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  status: true,
  emailVerified: true,
  avatarUrl: true,
  createdAt: true,
  vendor: { select: { id: true } },
} as const;

type UserWithVendor = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: SessionUser["role"];
  status: "ACTIVE" | "SUSPENDED";
  emailVerified: boolean;
  avatarUrl: string | null;
  createdAt: Date;
  vendor: { id: string } | null;
};

export { userSelect };

/** Mints an access token and persists a hashed refresh token for this device. */
export async function issueSession(
  user: UserWithVendor,
  req: Request,
): Promise<IssuedSession> {
  const vendorId = user.vendor?.id ?? null;
  const { token: refreshToken, tokenHash } = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      userAgent: req.get("user-agent")?.slice(0, 255) ?? null,
      ipAddress: req.ip ?? null,
      expiresAt: new Date(Date.now() + ttlToMs(env.jwt.refreshTtl)),
    },
  });

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    vendorId,
  });

  return { user: toSessionUser(user, vendorId), accessToken, refreshToken };
}

/** Rotates a refresh token: the presented one is revoked and a new one issued. */
export async function rotateSession(
  presentedToken: string,
  req: Request,
): Promise<IssuedSession> {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(presentedToken) },
    include: { user: { select: userSelect } },
  });

  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw unauthorized("Your session has expired — please sign in again");
  }
  if (record.user.status === "SUSPENDED") {
    throw unauthorized("This account has been suspended");
  }

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  return issueSession(record.user as UserWithVendor, req);
}

export async function revokeRefreshToken(presentedToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(presentedToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function assertEmailAvailable(email: string): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });
  if (existing) throw conflict("An account with that email already exists");
}

type Purpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET";

/**
 * Email verification uses a six-digit code, because the verify-email screen is
 * built around an OTP input and the code is only ever checked for the user who
 * is already signed in. Password reset uses a long random link token, since
 * that endpoint has to be safe to call with no session at all.
 */
function generateSecret(purpose: Purpose): string {
  if (purpose === "EMAIL_VERIFICATION") {
    return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  }
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Issues a single-use secret and invalidates any earlier one for the same
 * purpose. Returns the plaintext — the caller delivers it.
 *
 * TODO: wire an email provider. Until then it is written to the log in
 * development so the flow is testable end to end.
 */
export async function issueAuthToken(
  userId: string,
  purpose: Purpose,
  ttlMs: number,
): Promise<string> {
  const secret = generateSecret(purpose);

  await prisma.authToken.updateMany({
    where: { userId, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.authToken.create({
    data: {
      userId,
      purpose,
      // Codes are only unique per user, so the hash is salted with the user id
      // to keep the tokenHash column globally unique.
      tokenHash: hashToken(`${userId}:${secret}`),
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });

  if (!env.isProduction) {
    if (purpose === "EMAIL_VERIFICATION") {
      logger.info(`[dev] verification code for ${userId}: ${secret}`);
    } else {
      logger.info(
        `[dev] password reset link: ${env.webUrl}/reset-password?token=${secret}`,
      );
    }
  }

  return secret;
}

/** Verifies a code against a known user (email verification). */
export async function consumeUserCode(
  userId: string,
  code: string,
  purpose: Purpose,
): Promise<void> {
  const record = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(`${userId}:${code}`) },
  });

  if (
    !record ||
    record.userId !== userId ||
    record.purpose !== purpose ||
    record.usedAt ||
    record.expiresAt < new Date()
  ) {
    throw unauthorized("That code is invalid or has expired");
  }

  await prisma.authToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
}

/**
 * Verifies a reset token with no session to scope it. The token is hashed with
 * each candidate user id, so the lookup is done by scanning the small set of
 * live reset tokens rather than by a single indexed read.
 */
export async function consumeResetToken(token: string): Promise<string> {
  const live = await prisma.authToken.findMany({
    where: {
      purpose: "PASSWORD_RESET",
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, userId: true, tokenHash: true },
  });

  const match = live.find(
    (row) => row.tokenHash === hashToken(`${row.userId}:${token}`),
  );
  if (!match) throw unauthorized("That link is invalid or has expired");

  await prisma.authToken.update({
    where: { id: match.id },
    data: { usedAt: new Date() },
  });

  return match.userId;
}
