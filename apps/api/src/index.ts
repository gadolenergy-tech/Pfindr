import { createApp } from "./app";
import { env } from "./env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { paymentsEnabled } from "./lib/paystack";
import { expireStaleCheckouts } from "./services/checkout.service";

async function main() {
  const app = createApp();

  const server = app.listen(env.port, () => {
    logger.info(`Finder API listening on http://localhost:${env.port}/api`);
    logger.info(`Environment: ${env.nodeEnv}`);
    if (!paymentsEnabled()) logger.warn("PAYSTACK_SECRET_KEY is not set — Buy now will be unavailable");
  });

  // Return stock held by checkouts that were never paid.
  const sweeper = setInterval(() => {
    expireStaleCheckouts().catch((err: unknown) => logger.error(`checkout sweep failed: ${String(err)}`));
  }, 60_000);
  sweeper.unref();

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
