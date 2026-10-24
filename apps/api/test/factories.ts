import { prisma } from "../src/lib/prisma";

let n = 0;
const uid = () => `${Date.now().toString(36)}${(n++).toString(36)}`;

/** Empties every table so each test starts from nothing. */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

export async function makeUser(overrides: { role?: "USER" | "VENDOR" | "ADMIN"; email?: string } = {}) {
  const id = uid();
  return prisma.user.create({
    data: {
      email: overrides.email ?? `user-${id}@test.dev`,
      passwordHash: "x",
      fullName: `Test User ${id}`,
      role: overrides.role ?? "USER",
    },
  });
}

export async function makeVendor(overrides: { status?: "VERIFIED" | "PENDING"; listingPaused?: boolean } = {}) {
  const id = uid();
  const user = await makeUser({ role: "VENDOR" });
  return prisma.vendor.create({
    data: {
      userId: user.id,
      businessName: `Vendor ${id}`,
      slug: `vendor-${id}`,
      contactEmail: user.email,
      contactPhone: "+2348000000000",
      status: overrides.status ?? "VERIFIED",
      listingPaused: overrides.listingPaused ?? false,
    },
  });
}

export async function makeItem(
  vendorId: string,
  overrides: {
    quantity?: number;
    price?: number;
    currency?: string;
    lowStockThreshold?: number;
    name?: string;
    sku?: string;
    brand?: string;
    imageUrl?: string;
  } = {},
) {
  return prisma.inventoryItem.create({
    data: {
      vendorId,
      name: overrides.name ?? "Cement 50kg",
      sku: overrides.sku ?? `SKU-${uid()}`,
      brand: overrides.brand ?? null,
      imageUrl: overrides.imageUrl ?? null,
      quantity: overrides.quantity ?? 10,
      unit: "bag",
      price: overrides.price ?? 5000,
      currency: overrides.currency ?? "NGN",
      lowStockThreshold: overrides.lowStockThreshold ?? 2,
    },
  });
}

export const checkoutInput = (inventoryItemId: string, quantity = 1) => ({
  items: [{ inventoryItemId, quantity }],
  fulfilment: "PICKUP" as const,
  buyerPhone: "+2348011111111",
});
