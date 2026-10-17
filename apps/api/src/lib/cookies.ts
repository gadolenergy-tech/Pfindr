import type { Response } from "express";
import { env } from "../env";
import { ttlToMs } from "./jwt";

export const ACCESS_COOKIE = "finder_access";
export const REFRESH_COOKIE = "finder_refresh";

/**
 * Tokens ride in httpOnly cookies rather than localStorage. The Next apps talk
 * to this API through their own /api/proxy route, so the cookies are
 * same-origin from the browser's point of view and JS never touches them.
 */
function baseOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax" as const,
    path: "/",
  };
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions(),
    maxAge: ttlToMs(env.jwt.accessTtl),
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(),
    maxAge: ttlToMs(env.jwt.refreshTtl),
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, baseOptions());
  res.clearCookie(REFRESH_COOKIE, baseOptions());
}
