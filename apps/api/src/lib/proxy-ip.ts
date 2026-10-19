import crypto from "crypto";
import net from "net";
import type { NextFunction, Request, Response } from "express";
import { env } from "../env";

/**
 * The browser never calls this API directly: it calls the Next app's
 * /api/proxy, which forwards here. On Vercel -> Railway the platform edge in
 * front of this API replaces X-Forwarded-For with the address it received the
 * connection from, so every visitor looks like one of Vercel's egress IPs and
 * would share a handful of rate-limit buckets.
 *
 * So the proxy passes the real visitor IP in its own header, along with a
 * shared secret proving the request came from our proxy. Without that proof the
 * header is ignored; otherwise anyone could pick their own IP and walk around
 * every rate limit.
 */

export const CLIENT_IP_HEADER = "x-finder-client-ip";
export const PROXY_SECRET_HEADER = "x-finder-proxy-secret";

/** Anything shorter is guessable, so it is treated as not configured. */
export const MIN_PROXY_SECRET_LENGTH = 32;

const header = (req: Request, name: string): string | null => {
  const value = req.headers[name];
  return typeof value === "string" ? value : null;
};

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** The visitor IP the proxy vouches for, or null if the request is not trusted. */
export function proxiedClientIp(req: Request): string | null {
  const secret = env.proxySecret;
  if (secret.length < MIN_PROXY_SECRET_LENGTH) return null;

  const given = header(req, PROXY_SECRET_HEADER);
  const ip = header(req, CLIENT_IP_HEADER)?.trim();
  if (!given || !ip || !sameSecret(given, secret) || net.isIP(ip) === 0) return null;
  return ip;
}

/**
 * Must run before the loggers and rate limiters so they all see the real
 * visitor. `req.ip` is a getter on Express's request prototype; defining it on
 * the instance overrides it for this request only.
 */
export function trustProxiedClientIp(req: Request, _res: Response, next: NextFunction): void {
  const ip = proxiedClientIp(req);
  if (ip) Object.defineProperty(req, "ip", { value: ip, configurable: true });
  next();
}
