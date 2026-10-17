/**
 * Seeds the six discovery categories the landing page already renders, plus an
 * admin account and one verified demo vendor with stock, so the auth flow and
 * the category tiles have something real behind them on a fresh database.
 *
 * Run: npm run db:seed --workspace @finder/api
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { env } from "../src/env";
import { CATEGORIES } from "./categories";
import { seedProximityVendors } from "./seed-vendors";

const adapter = new PrismaPg({ connectionString: env.databaseUrl });
const prisma = new PrismaClient({ adapter });


async function main() {
  if (env.isProduction && process.env.ALLOW_SEED_IN_PRODUCTION !== "1") {
    throw new Error(
      "Refusing to seed a production database: it creates accounts with a published password. Use `npm run db:bootstrap` instead.",
    );
  }

  console.log("Seeding categories...");
  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
  }

  const passwordHash = await bcrypt.hash("Finder123!", 12);

  console.log("Seeding admin account...");
  await prisma.user.upsert({
    where: { email: "admin@finder.network" },
    update: {},
    create: {
      email: "admin@finder.network",
      passwordHash,
      fullName: "Finder Admin",
      role: "ADMIN",
      emailVerified: true,
    },
  });

  console.log("Seeding demo vendor...");
  const healthcare = await prisma.category.findUniqueOrThrow({
    where: { slug: "healthcare" },
  });

  const vendorUser = await prisma.user.upsert({
    where: { email: "vendor@finder.network" },
    update: {},
    create: {
      email: "vendor@finder.network",
      passwordHash,
      fullName: "Demo Vendor",
      phone: "+2348000000000",
      role: "VENDOR",
      emailVerified: true,
    },
  });

  const vendor = await prisma.vendor.upsert({
    where: { userId: vendorUser.id },
    update: {},
    create: {
      userId: vendorUser.id,
      businessName: "Citadel Pharmacy",
      slug: "citadel-pharmacy",
      description:
        "Full-service pharmacy and medical supplier with live inventory on Finder.",
      categoryId: healthcare.id,
      contactEmail: "vendor@finder.network",
      contactPhone: "+2348000000000",
      status: "VERIFIED",
      verifiedAt: new Date(),
      rating: 4.8,
      reviewCount: 126,
      addressLine1: "14 Aba Road",
      city: "Port Harcourt",
      state: "Rivers",
      country: "Nigeria",
      latitude: 4.8156,
      longitude: 7.0498,
    },
  });

  const items = [
    { name: "Paracetamol 500mg (100 tabs)", sku: "PCM-500-100", quantity: 420, price: "3500.00" },
    { name: "Amoxicillin 250mg (60 caps)", sku: "AMX-250-60", quantity: 85, price: "7200.00" },
    { name: "Surgical Gloves (Box of 100)", sku: "GLV-SRG-100", quantity: 8, price: "12500.00" },
    { name: "Blood Bag — O Negative", sku: "BLD-ONEG", quantity: 0, price: "45000.00" },
  ];

  for (const item of items) {
    const status =
      item.quantity === 0
        ? "OUT_OF_STOCK"
        : item.quantity <= 10
          ? "LOW_STOCK"
          : "IN_STOCK";

    await prisma.inventoryItem.upsert({
      where: { vendorId_sku: { vendorId: vendor.id, sku: item.sku } },
      update: { quantity: item.quantity, status },
      create: {
        vendorId: vendor.id,
        categoryId: healthcare.id,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unit: "pack",
        price: item.price,
        currency: "NGN",
        status,
        lastSyncedAt: new Date(),
      },
    });
  }

  console.log("Seeding proximity-test vendors...");
  const count = await seedProximityVendors(prisma, passwordHash);
  console.log(`  ${count} vendors across Port Harcourt and other cities`);

  console.log("Seed complete.");
  console.log("  admin@finder.network  / Finder123!");
  console.log("  vendor@finder.network / Finder123!");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
