import { execSync } from "node:child_process";
import path from "node:path";
import { Client } from "pg";
import { E2E_DB_NAME, e2eDatabaseUrl } from "./env";

/** Drops and rebuilds the e2e database, applies migrations, and seeds the demo accounts. */
export default async function globalSetup() {
  const url = new URL(e2eDatabaseUrl());
  const dbName = decodeURIComponent(url.pathname.slice(1));
  if (dbName !== E2E_DB_NAME) throw new Error(`Refusing to reset "${dbName}": only ${E2E_DB_NAME} may be rebuilt.`);

  const admin = new URL(url.toString());
  admin.pathname = "/postgres";
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await client.end();
  }

  const apiDir = path.resolve(__dirname, "..", "apps", "api");
  const env = { ...process.env, DATABASE_URL: url.toString() };
  execSync("npx prisma migrate deploy", { cwd: apiDir, env, stdio: "pipe" });
  execSync("npx ts-node prisma/seed.ts", { cwd: apiDir, env, stdio: "pipe" });
}
