/**
 * Prepares a fresh production database: the discovery categories the site
 * renders, and the first admin account. Safe to re-run — categories are
 * upserted and an existing admin is left untouched.
 *
 * Unlike db:seed it creates no demo data and no account with a published
 * password; the admin's credentials come from the environment.
 *
 * Run (once, after db:deploy):
 *   ADMIN_EMAIL=you@company.com ADMIN_PASSWORD='a long passphrase' \
 *     npm run db:bootstrap --workspace @finder/api
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { env } from "../src/env";
import { CATEGORIES } from "./categories";

const MIN_PASSWORD = 12;

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Finder Admin";

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("Set ADMIN_EMAIL to the admin's email address.");
  }
  if (!password || password.length < MIN_PASSWORD) {
    throw new Error(`Set ADMIN_PASSWORD to at least ${MIN_PASSWORD} characters.`);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.databaseUrl }) });
  try {
    for (const category of CATEGORIES) {
      await prisma.category.upsert({ where: { slug: category.slug }, update: category, create: category });
    }
    console.log(`Categories ready (${CATEGORIES.length}).`);

    const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
    if (existing) {
      if (existing.role !== "ADMIN") {
        throw new Error(`${email} already exists as a ${existing.role}. Use a different ADMIN_EMAIL.`);
      }
      console.log(`Admin ${email} already exists; left unchanged.`);
      return;
    }

    await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        fullName: name,
        role: "ADMIN",
        emailVerified: true,
      },
    });
    console.log(`Created admin ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
