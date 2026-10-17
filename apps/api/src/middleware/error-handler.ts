import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";
import { env } from "../env";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    ok: false,
    error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` },
  });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      ok: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({
        ok: false,
        error: { code: "CONFLICT", message: "That record already exists" },
      });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({
        ok: false,
        error: { code: "NOT_FOUND", message: "Record not found" },
      });
      return;
    }
  }

  logger.error(err instanceof Error ? err : new Error(String(err)));
  res.status(500).json({
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: env.isProduction
        ? "Something went wrong on our end"
        : String(err instanceof Error ? err.message : err),
    },
  });
}
