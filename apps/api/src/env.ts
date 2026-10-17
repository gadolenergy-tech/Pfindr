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

/**
 * Returns what is wrong with the JWT secrets, or null if they are fine. A
 * placeholder or short secret in production lets anyone mint a valid token, so
 * the server refuses to start rather than run that way.
 */
export function jwtSecretProblem(access: string, refresh: string): string | null {
  for (const [name, secret] of [["JWT_ACCESS_SECRET", access], ["JWT_REFRESH_SECRET", refresh]] as const) {
    if (secret.length < 32 || /change-me|changeme|secret|password/i.test(secret)) {
      return `${name} must be a random string of at least 32 characters in production (try: openssl rand -base64 48).`;
    }
  }
  return access === refresh ? "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different." : null;
}

if (process.env.NODE_ENV === "production") {
  const problem = jwtSecretProblem(required("JWT_ACCESS_SECRET"), required("JWT_REFRESH_SECRET"));
  if (problem) throw new Error(problem);
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
  /**
   * How many proxies sit in front of the API, so rate limiting sees the real
   * client IP. 1 for a single reverse proxy; 2 when the web app's /api/proxy
   * (e.g. on Vercel) calls an API that is itself behind a platform proxy
   * (e.g. Railway). Too low and every visitor shares one rate-limit bucket;
   * too high and clients can spoof their IP.
   */
  trustProxyHops: Number(optional("TRUST_PROXY_HOPS", "1")),
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
  storage: {
    /** S3-compatible bucket (AWS S3, Cloudflare R2, MinIO). Empty disables uploads. */
    bucket: optional("S3_BUCKET", ""),
    region: optional("S3_REGION", "auto"),
    /** Set for R2/MinIO; leave empty for AWS S3. */
    endpoint: optional("S3_ENDPOINT", ""),
    accessKeyId: optional("S3_ACCESS_KEY_ID", ""),
    secretAccessKey: optional("S3_SECRET_ACCESS_KEY", ""),
    /** Public base URL objects are served from (CDN or r2.dev), no trailing slash. */
    publicUrl: optional("S3_PUBLIC_URL", "").replace(/\/+$/, ""),
  },
  /** Finder's cut of each paid checkout order, in percent. Zero until pricing is decided. */
  platformFeePercent: Number(optional("PLATFORM_FEE_PERCENT", "0")),
  /** How long Buy now holds stock while the buyer pays. */
  checkoutHoldMinutes: Number(optional("CHECKOUT_HOLD_MINUTES", "30")),
} as const;
