import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import type { ApiKeyScope } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { hashToken } from "../lib/jwt";
import { AppError, forbidden } from "../lib/errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiKey?: { id: string; vendorId: string; scopes: ApiKeyScope[] };
    }
  }
}

export const KEY_PREFIX = "fndr_live_";

/**
 * fndr_live_ + 40 random base62 chars. The first 8 random chars ride along in
 * keyPrefix so the dashboard can show which key is which without ever storing
 * or displaying the secret again.
 */
export function generateApiKey(): { key: string; keyPrefix: string; keyHash: string } {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(40);
  let secret = "";
  for (const byte of bytes) secret += alphabet[byte % alphabet.length];
  const key = KEY_PREFIX + secret;
  return { key, keyPrefix: key.slice(0, KEY_PREFIX.length + 8), keyHash: hashToken(key) };
}

const unauthorizedKey = (message: string) => new AppError(401, "INVALID_API_KEY", message);

/** Only touch lastUsedAt once a minute per key, not on every request. */
const LAST_USED_THROTTLE_MS = 60_000;

export async function requireApiKey(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  const presented = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!presented || !presented.startsWith(KEY_PREFIX)) {
    return next(unauthorizedKey("Send your key as: Authorization: Bearer fndr_live_…"));
  }

  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hashToken(presented) },
    include: { vendor: { select: { status: true } } },
  });

  if (!key || key.revokedAt) return next(unauthorizedKey("This API key is invalid or revoked"));
  if (key.expiresAt && key.expiresAt < new Date()) {
    return next(unauthorizedKey("This API key has expired"));
  }
  if (key.vendor.status === "SUSPENDED" || key.vendor.status === "REJECTED") {
    return next(forbidden("This vendor account cannot use the API"));
  }

  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
    void prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
  }

  req.apiKey = { id: key.id, vendorId: key.vendorId, scopes: key.scopes };
  next();
}

export const requireScope =
  (scope: ApiKeyScope) => (req: Request, _res: Response, next: NextFunction) => {
    if (!req.apiKey?.scopes.includes(scope)) {
      return next(forbidden(`This key is missing the ${scope} scope`));
    }
    next();
  };
