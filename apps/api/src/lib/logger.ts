import winston from "winston";
import { env } from "../env";

export const logger = winston.createLogger({
  level: env.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    env.isProduction
      ? winston.format.json()
      : winston.format.printf(({ level, message, timestamp, stack }) =>
          `${timestamp} ${level}: ${stack ?? message}`,
        ),
  ),
  transports: [new winston.transports.Console()],
});
