import { execSync } from "node:child_process";
import path from "node:path";
import { Client } from "pg";
import { testDatabaseUrl } from "./test-env";

/** Creates the test database if needed and applies every migration to it. */
export default async function setup() {
  const url = new URL(testDatabaseUrl());
  const dbName = decodeURIComponent(url.pathname.slice(1));

  if (!/^[a-z0-9_]*test[a-z0-9_]*$/i.test(dbName)) {
    throw new Error(`Refusing to run tests against "${dbName}": the database name must contain "test".`);
  }

  const admin = new URL(url.toString());
  admin.pathname = "/postgres";
  admin.search = "";
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const found = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (found.rowCount === 0) await client.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await client.end();
  }

  execSync("npx prisma migrate deploy", {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: "pipe",
  });
}
