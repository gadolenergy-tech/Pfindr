/**
 * The test database URL. CI provides DATABASE_URL_TEST; locally it is derived
 * from apps/api/.env by swapping the database name, so tests can never touch
 * the development database.
 */
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

export const TEST_DB_NAME = "finder_network_test";

export function testDatabaseUrl(): string {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error("Set DATABASE_URL_TEST (or DATABASE_URL in apps/api/.env) to run the tests.");
  }
  const url = new URL(base);
  url.pathname = `/${TEST_DB_NAME}`;
  return url.toString();
}
