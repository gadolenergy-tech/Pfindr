import path from "path";
import dotenv from "dotenv";

// apps/api/.env wins; the repo-root .env is the fallback so a single file can
// drive all three apps during local development.
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "..", "..", ".env") });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy apps/api/.env.example to apps/api/.env.`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  isProduction: process.env.NODE_ENV === "production",
  port: Number(optional("PORT", "5020")),
  databaseUrl: required("DATABASE_URL"),
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessTtl: optional("ACCESS_TOKEN_TTL", "15m"),
    refreshTtl: optional("REFRESH_TOKEN_TTL", "30d"),
  },
  corsOrigins: optional("CORS_ORIGINS", "http://localhost:3020,http://localhost:3021")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  webUrl: optional("WEB_URL", "http://localhost:3020"),
  logLevel: optional("LOG_LEVEL", "info"),
  paystack: {
    /** sk_test_… or sk_live_…. Empty disables checkout with a clear error. */
    secretKey: optional("PAYSTACK_SECRET_KEY", ""),
  },
  email: {
    /** Resend API key (re_…). Empty disables sending; codes are logged in dev. */
    apiKey: optional("RESEND_API_KEY", ""),
    /** Must be an address on a domain verified in Resend. */
    from: optional("EMAIL_FROM", "Finder Network <onboarding@resend.dev>"),
  },
  /** How long Buy now holds stock while the buyer pays. */
  checkoutHoldMinutes: Number(optional("CHECKOUT_HOLD_MINUTES", "30")),
} as const;
