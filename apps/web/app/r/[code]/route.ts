import { type NextRequest, NextResponse } from "next/server";

/**
 * Referral links: finder.network/r/AFF1234ABCD
 *
 * Counts the click with the API, drops a 90-day httpOnly attribution cookie on
 * this origin, and sends the visitor to sign up. The cookie rides through the
 * /api/proxy BFF on registration, where the API credits the affiliate.
 */
const API_URL = process.env.API_URL ?? "http://localhost:5020";
const NINETY_DAYS = 90 * 24 * 60 * 60;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await ctx.params;
  const destination = new URL("/signup", req.url);

  // Only well-formed codes are worth a round trip.
  if (!/^AFF[0-9A-F]{10}$/.test(code)) return NextResponse.redirect(destination);

  let valid = false;
  try {
    const res = await fetch(`${API_URL}/api/affiliate/click/${code}`, {
      method: "POST",
      headers: { "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "" },
      cache: "no-store",
    });
    valid = res.ok;
  } catch {
    // API down: still send the visitor on; they just won't be attributed.
  }

  const response = NextResponse.redirect(destination);
  if (valid) {
    response.cookies.set("finder_ref", code, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: NINETY_DAYS,
    });
  }
  return response;
}

export const dynamic = "force-dynamic";
