import type { NextFunction, Request, Response } from "express";
import type { AccessTokenPayload, Role } from "@finder/shared";
import { verifyAccessToken } from "../lib/jwt";
import { ACCESS_COOKIE } from "../lib/cookies";
import { forbidden, unauthorized } from "../lib/errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
    }
  }
}

function readToken(req: Request): string | null {
  const cookie = req.cookies?.[ACCESS_COOKIE];
  if (cookie) return cookie;
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return null;
}

/** Populates req.auth when a valid token is present, but never rejects. */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const token = readToken(req);
  if (token) {
    try {
      req.auth = verifyAccessToken(token);
    } catch {
      // An expired token on a public route is not an error; the client will
      // refresh on its next authenticated call.
    }
  }
  next();
}

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const token = readToken(req);
  if (!token) return next(unauthorized());
  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch {
    next(unauthorized("Your session has expired"));
  }
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized());
    if (!roles.includes(req.auth.role)) return next(forbidden());
    next();
  };

/** Vendor endpoints need both the role and an actual vendor profile. */
export function requireVendor(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.auth) return next(unauthorized());
  if (req.auth.role !== "VENDOR" && req.auth.role !== "ADMIN") {
    return next(forbidden("This area is for vendors"));
  }
  if (!req.auth.vendorId && req.auth.role !== "ADMIN") {
    return next(forbidden("Finish setting up your vendor profile first"));
  }
  next();
}

/**
 * The vendor a request acts on. Vendor-scoped routes always use the vendor from
 * the token — never an id from the URL or body — so one vendor can never read
 * or write another's records.
 */
export function vendorIdOf(req: Request): string {
  const vendorId = req.auth?.vendorId;
  if (!vendorId) throw forbidden("Finish setting up your vendor profile first");
  return vendorId;
}
