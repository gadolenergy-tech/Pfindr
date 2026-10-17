import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ok } from "../lib/respond";

const router = Router();

router.get("/healthz", async (_req, res) => {
  let database: "up" | "down" = "up";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "down";
  }

  return ok(res, {
    status: database === "up" ? "healthy" : "degraded",
    database,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export default router;
