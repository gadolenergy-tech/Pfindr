import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodSchema } from "zod";
import { AppError } from "../lib/errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Query params after Zod parsing, with the schema's defaults applied. */
      validatedQuery?: unknown;
      /** The body as sent, before Zod applied defaults. */
      rawBody?: Record<string, unknown>;
    }
  }
}

function fail(error: ZodError): AppError {
  return new AppError(
    422,
    "VALIDATION_ERROR",
    "Some fields need attention",
    error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  );
}

export const validateBody =
  <T>(schema: ZodSchema<T>) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(fail(result.error));
    req.rawBody = req.body && typeof req.body === "object" ? req.body : {};
    req.body = result.data;
    next();
  };

/**
 * Express 5 made req.query a getter, so parsed values go on req.validatedQuery
 * instead of overwriting it. Read them back with parsedQuery().
 */
export const validateQuery =
  <T>(schema: ZodSchema<T>) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return next(fail(result.error));
    req.validatedQuery = result.data;
    next();
  };

export function parsedQuery<T>(req: Request): T {
  return req.validatedQuery as T;
}

export const validateParams =
  <T>(schema: ZodSchema<T>) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) return next(fail(result.error));
    next();
  };
