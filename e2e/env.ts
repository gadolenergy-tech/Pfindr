/**
 * Shared settings for the suite. Ports differ from `npm run dev` (5020/3020)
 * so the suite never collides with servers already running, and the database is
 * its own, dropped and rebuilt on every run, so the dev database is never touched.
 */
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "..", "apps", "api", ".env"), quiet: true });

export const E2E_DB_NAME = "finder_network_e2e";
export const API_PORT = 5120;
export const WEB_PORT = 3120;
export const MOCK_PORT = 5199;

export const WEB_URL = `http://localhost:${WEB_PORT}`;
export const API_URL = `http://localhost:${API_PORT}`;
export const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}`;

export const PAYSTACK_SECRET = "sk_test_e2e_stand_in";
export const PASSWORD = "Finder123!";

export const ACCOUNTS = {
  buyer: { email: "buyer@finder.network", password: PASSWORD, name: "Demo Buyer" },
  vendor: { email: "vendor@finder.network", password: PASSWORD, name: "Demo Vendor", business: "Citadel Pharmacy" },
  newVendor: { email: "newvendor@finder.network", password: PASSWORD, name: "Demo New Vendor", business: "Greenfield Supplies" },
  admin: { email: "admin@finder.network", password: PASSWORD, name: "Finder Admin" },
} as const;

/** The dev DATABASE_URL with only the database name swapped. */
export function e2eDatabaseUrl(): string {
  const base = process.env.DATABASE_URL_E2E ?? process.env.DATABASE_URL;
  if (!base) throw new Error("Set DATABASE_URL (apps/api/.env) or DATABASE_URL_E2E to run the e2e suite.");
  const url = new URL(base);
  url.pathname = `/${E2E_DB_NAME}`;
  return url.toString();
}
