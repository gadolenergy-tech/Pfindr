import type { Response } from "express";

/**
 * Every endpoint answers with { ok: true, data } or { ok: false, error }.
 * The web/admin fetch wrappers unwrap this, so keep the envelope stable —
 * the matching types live in packages/shared/src/common.ts.
 */
export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ ok: true, data });
}

export function created<T>(res: Response, data: T): Response {
  return ok(res, data, 201);
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}

export function paginated<T>(
  res: Response,
  data: T[],
  meta: { page: number; limit: number; total: number },
): Response {
  return res.status(200).json({
    ok: true,
    data,
    meta: { ...meta, totalPages: Math.max(1, Math.ceil(meta.total / meta.limit)) },
  });
}
