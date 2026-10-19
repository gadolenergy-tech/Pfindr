import { type NextRequest, NextResponse } from "next/server";

/**
 * Same-origin BFF proxy.
 *
 * The browser calls /api/proxy/auth/login; this forwards to
 * API_URL/api/auth/login, carrying the request cookies up and the response's
 * Set-Cookie headers back down. Because both hops look same-origin to the
 * browser, the access and refresh tokens stay httpOnly and JS never sees them.
 */

const API_URL = process.env.API_URL ?? "http://localhost:5020";

// Hop-by-hop and host-specific headers must not be forwarded verbatim.
const STRIPPED = new Set([
  "host",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "content-length",
  // fetch() already decodes a compressed body, so passing the header on would
  // make the browser decode it a second time. Asking upstream for plain text
  // (Vercel compresses for the browser itself) avoids the mismatch entirely.
  "content-encoding",
  "accept-encoding",
]);

async function forward(req: NextRequest, path: string[]): Promise<Response> {
  const target = new URL(`/api/${path.join("/")}`, API_URL);
  target.search = req.nextUrl.search;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!STRIPPED.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set("x-forwarded-for", req.headers.get("x-forwarded-for") ?? "");

  const hasBody = !["GET", "HEAD"].includes(req.method);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "Cannot reach the Finder API. Is apps/api running?",
        },
      },
      { status: 502 },
    );
  }

  // Buffer the body instead of piping upstream's stream through. These are
  // small JSON payloads, and on Vercel a piped stream came back empty once the
  // body outgrew the first chunk (a ~1 KB list rendered as "no results").
  // 101/204/205/304 must not carry a body at all.
  const noBody = [101, 204, 205, 304].includes(upstream.status);
  const response = new NextResponse(noBody ? null : await upstream.arrayBuffer(), {
    status: upstream.status,
    statusText: upstream.statusText,
  });

  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    if (STRIPPED.has(key.toLowerCase())) return;
    response.headers.set(key, value);
  });

  // getSetCookie preserves multiple Set-Cookie headers, which a plain get()
  // would collapse into one malformed value.
  for (const cookie of upstream.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}

type Context = { params: Promise<{ path: string[] }> };

async function handler(req: NextRequest, ctx: Context): Promise<Response> {
  const { path } = await ctx.params;
  return forward(req, path);
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;

export const dynamic = "force-dynamic";
