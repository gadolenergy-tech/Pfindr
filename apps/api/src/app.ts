// Patches Express 4 so a rejected promise in an async handler reaches the
// error middleware instead of hanging the request. Must be imported first.
import "express-async-errors";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./env";
import { logger } from "./lib/logger";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";

export function createApp() {
  const app = express();

  // Behind the Next.js BFF proxy (and any production reverse proxy), so req.ip
  // needs to come from X-Forwarded-For for rate limiting to be meaningful.
  // See TRUST_PROXY_HOPS in env.ts for what to set per deployment.
  app.set("trust proxy", env.trustProxyHops);

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(
    express.json({
      limit: "1mb",
      // Kept for webhook signature checks, which hash the exact bytes sent.
      verify: (req, _res, buf) => {
        (req as typeof req & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use(
    morgan(env.isProduction ? "combined" : "dev", {
      stream: { write: (line) => logger.info(line.trim()) },
    }),
  );

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
  );

  app.use("/api", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
