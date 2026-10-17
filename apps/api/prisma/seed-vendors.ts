/**
 * Demo vendors for exercising proximity search. A dense Port Harcourt cluster
 * (1–25 km apart) tests fine-grained ordering; vendors in other cities test
 * nationwide ranking. Most products are stocked by several vendors so one
 * search returns the same item at clearly different distances.
 *
 * Deterministic: prices and quantities derive from the vendor/product pair,
 * so re-running the seed updates rows in place rather than reshuffling them.
 */
import type { PrismaClient } from "@prisma/client";

type CategorySlug =
  | "healthcare"
  | "food-beverage"
  | "industrial"
  | "oil-gas"
  | "emergency"
  | "everyday";

type Product = {
  name: string;
  sku: string;
  category: CategorySlug;
  unit: string;
  basePrice: number;
};

/** Shared catalogue. Names repeat a common keyword so one search hits many vendors. */
const PRODUCTS = {
  paracetamol: { name: "Paracetamol 500mg Tablets (100)", sku: "PCM-500-100", category: "healthcare", unit: "pack", basePrice: 3500 },
  emzorPcm: { name: "Emzor Paracetamol 500mg (Card of 12)", sku: "PCM-EMZ-12", category: "healthcare", unit: "card", basePrice: 400 },
  amoxicillin: { name: "Amoxicillin 500mg Capsules (100)", sku: "AMX-500-100", category: "healthcare", unit: "pack", basePrice: 9800 },
  coartem: { name: "Coartem Artemether/Lumefantrine 80/480", sku: "ART-COA-6", category: "healthcare", unit: "pack", basePrice: 4200 },
  insulin: { name: "Insulin Mixtard 30/70 (10ml vial)", sku: "INS-MIX-10", category: "healthcare", unit: "vial", basePrice: 11500 },
  ors: { name: "ORS Oral Rehydration Salts (Sachet)", sku: "ORS-SACH", category: "healthcare", unit: "sachet", basePrice: 250 },
  gloves: { name: "Surgical Gloves (Box of 100)", sku: "GLV-SRG-100", category: "healthcare", unit: "box", basePrice: 12500 },
  bloodOPos: { name: "Blood Bag — O Positive", sku: "BLD-OPOS", category: "healthcare", unit: "pint", basePrice: 30000 },
  bloodONeg: { name: "Blood Bag — O Negative", sku: "BLD-ONEG", category: "healthcare", unit: "pint", basePrice: 45000 },

  palmOil: { name: "Palm Oil 25L Keg", sku: "FD-PALM-25", category: "food-beverage", unit: "keg", basePrice: 52000 },
  rice: { name: "Rice 50kg Bag (Parboiled)", sku: "FD-RICE-50", category: "food-beverage", unit: "bag", basePrice: 78000 },
  garri: { name: "Garri White 50kg Bag", sku: "FD-GARRI-50", category: "food-beverage", unit: "bag", basePrice: 41000 },
  noodles: { name: "Indomie Noodles 70g (Carton of 40)", sku: "FD-INDO-40", category: "food-beverage", unit: "carton", basePrice: 9500 },
  water: { name: "Table Water 75cl (Pack of 12)", sku: "FD-WATER-12", category: "food-beverage", unit: "pack", basePrice: 1800 },

  weldingRod: { name: "Welding Rod 2.5mm (5kg Pack)", sku: "IND-WELD-25", category: "industrial", unit: "pack", basePrice: 14500 },
  cement: { name: "Dangote Cement 50kg Bag", sku: "IND-CEM-50", category: "industrial", unit: "bag", basePrice: 9800 },
  hydraulicPump: { name: "Hydraulic Pump 3HP", sku: "IND-HPUMP-3", category: "industrial", unit: "unit", basePrice: 385000 },
  grinder: { name: "Angle Grinder 9-inch", sku: "IND-GRIND-9", category: "industrial", unit: "unit", basePrice: 68000 },

  gasCylinder: { name: "Gas Cylinder 12.5kg (Filled LPG)", sku: "OG-LPG-125", category: "oil-gas", unit: "cylinder", basePrice: 21000 },
  diesel: { name: "Diesel (AGO) — per Litre", sku: "OG-AGO-1L", category: "oil-gas", unit: "litre", basePrice: 1350 },
  coverall: { name: "Fire-Retardant Coverall (FRC)", sku: "OG-FRC", category: "oil-gas", unit: "piece", basePrice: 38000 },
  h2sDetector: { name: "H2S Gas Detector (Single-Gas)", sku: "OG-H2S-DET", category: "oil-gas", unit: "unit", basePrice: 165000 },

  extinguisher: { name: "Fire Extinguisher 9kg (DCP)", sku: "EM-FEXT-9", category: "emergency", unit: "unit", basePrice: 32000 },
  firstAid: { name: "First Aid Kit (Workplace, 50-piece)", sku: "EM-FAK-50", category: "emergency", unit: "kit", basePrice: 18500 },

  a4Paper: { name: "A4 Paper Ream (80gsm, 500 sheets)", sku: "EV-A4-500", category: "everyday", unit: "ream", basePrice: 6500 },
  batteries: { name: "AA Batteries (Pack of 4)", sku: "EV-AA-4", category: "everyday", unit: "pack", basePrice: 1600 },
} satisfies Record<string, Product>;

type ProductKey = keyof typeof PRODUCTS;

type SeedVendor = {
  businessName: string;
  slug: string;
  category: CategorySlug;
  addressLine1: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  rating: number;
  /** Defaults to VERIFIED. A non-verified vendor must never appear in search. */
  status?: "VERIFIED" | "PENDING";
  products: ProductKey[];
};

const HEALTH: ProductKey[] = ["paracetamol", "emzorPcm", "amoxicillin", "coartem", "ors", "gloves"];
const PROVISIONS: ProductKey[] = ["palmOil", "rice", "garri", "noodles", "water"];

export const SEED_VENDORS: SeedVendor[] = [
  // ---- Port Harcourt cluster -------------------------------------------
  { businessName: "GRA Medicare Pharmacy", slug: "gra-medicare-pharmacy", category: "healthcare", addressLine1: "21 Tombia Street, GRA Phase 2", city: "Port Harcourt", state: "Rivers", latitude: 4.824, longitude: 7.006, rating: 4.6, products: [...HEALTH, "insulin", "bloodOPos"] },
  { businessName: "D-Line Drugs & Stores", slug: "d-line-drugs", category: "healthcare", addressLine1: "8 Hospital Road, D-Line", city: "Port Harcourt", state: "Rivers", latitude: 4.807, longitude: 7.017, rating: 4.3, products: [...HEALTH, "batteries"] },
  { businessName: "Trans-Amadi Industrial Supplies", slug: "trans-amadi-industrial", category: "industrial", addressLine1: "Plot 45 Trans-Amadi Industrial Layout", city: "Port Harcourt", state: "Rivers", latitude: 4.81, longitude: 7.04, rating: 4.5, products: ["weldingRod", "cement", "hydraulicPump", "grinder", "coverall", "extinguisher", "firstAid"] },
  { businessName: "Woji Family Mart", slug: "woji-family-mart", category: "everyday", addressLine1: "3 Woji Road, by YKC", city: "Port Harcourt", state: "Rivers", latitude: 4.829, longitude: 7.061, rating: 4.2, products: [...PROVISIONS, "emzorPcm", "ors", "gasCylinder", "a4Paper", "batteries"] },
  { businessName: "Rumuokoro Wholesale Market Depot", slug: "rumuokoro-wholesale", category: "food-beverage", addressLine1: "Rumuokoro Junction, Ikwerre Road", city: "Port Harcourt", state: "Rivers", latitude: 4.87, longitude: 6.995, rating: 4.0, products: [...PROVISIONS, "gasCylinder", "cement"] },
  { businessName: "Choba Campus Pharmacy", slug: "choba-campus-pharmacy", category: "healthcare", addressLine1: "East-West Road, opp. UNIPORT Gate", city: "Port Harcourt", state: "Rivers", latitude: 4.893, longitude: 6.918, rating: 4.1, products: [...HEALTH, "noodles", "water", "a4Paper"] },
  { businessName: "Borokiri Gas & General Stores", slug: "borokiri-gas", category: "oil-gas", addressLine1: "12 Bonny Street, Borokiri", city: "Port Harcourt", state: "Rivers", latitude: 4.764, longitude: 7.027, rating: 3.9, products: ["gasCylinder", "diesel", "extinguisher", "palmOil", "rice"] },
  { businessName: "Onne Oilfield Services Store", slug: "onne-oilfield-store", category: "oil-gas", addressLine1: "FOT Onne Road, Eleme", city: "Onne", state: "Rivers", latitude: 4.723, longitude: 7.153, rating: 4.7, products: ["diesel", "coverall", "h2sDetector", "hydraulicPump", "weldingRod", "extinguisher", "firstAid", "gasCylinder"] },
  { businessName: "Rivers State Blood Services", slug: "rivers-blood-services", category: "healthcare", addressLine1: "Rumuigbo, off Ikwerre Road", city: "Port Harcourt", state: "Rivers", latitude: 4.858, longitude: 6.987, rating: 4.9, products: ["bloodOPos", "bloodONeg", "gloves", "firstAid"] },
  // Closest of all to central PH, but not verified — proves the status filter.
  { businessName: "Aba Road Pending Pharmacy", slug: "aba-road-pending-pharmacy", category: "healthcare", addressLine1: "16 Aba Road", city: "Port Harcourt", state: "Rivers", latitude: 4.8158, longitude: 7.0501, rating: 0, status: "PENDING", products: ["paracetamol", "amoxicillin", "gloves"] },

  // ---- Nearby towns ----------------------------------------------------
  { businessName: "Aba Pharma Distributors", slug: "aba-pharma-distributors", category: "healthcare", addressLine1: "54 Faulks Road", city: "Aba", state: "Abia", latitude: 5.1066, longitude: 7.3667, rating: 4.4, products: [...HEALTH, "insulin"] },
  { businessName: "Owerri Provisions Hub", slug: "owerri-provisions-hub", category: "food-beverage", addressLine1: "Douglas Road", city: "Owerri", state: "Imo", latitude: 5.4836, longitude: 7.0333, rating: 4.2, products: [...PROVISIONS, "paracetamol", "gasCylinder"] },

  // ---- Other cities ----------------------------------------------------
  { businessName: "Warri Delta Oil Tools", slug: "warri-delta-oil-tools", category: "oil-gas", addressLine1: "Effurun-Sapele Road", city: "Warri", state: "Delta", latitude: 5.5167, longitude: 5.75, rating: 4.5, products: ["diesel", "coverall", "h2sDetector", "weldingRod", "gasCylinder", "hydraulicPump"] },
  { businessName: "Enugu Coal City Pharmacy", slug: "enugu-coal-city-pharmacy", category: "healthcare", addressLine1: "Ogui Road", city: "Enugu", state: "Enugu", latitude: 6.44, longitude: 7.495, rating: 4.3, products: [...HEALTH, "bloodOPos"] },
  { businessName: "Ikeja Medplus Pharmacy", slug: "ikeja-medplus-pharmacy", category: "healthcare", addressLine1: "Allen Avenue, Ikeja", city: "Lagos", state: "Lagos", latitude: 6.6018, longitude: 3.3515, rating: 4.7, products: [...HEALTH, "insulin", "bloodONeg"] },
  { businessName: "Lekki Hardware & Builders", slug: "lekki-hardware", category: "industrial", addressLine1: "Admiralty Way, Lekki Phase 1", city: "Lagos", state: "Lagos", latitude: 6.4474, longitude: 3.47, rating: 4.4, products: ["cement", "weldingRod", "grinder", "hydraulicPump", "extinguisher", "a4Paper"] },
  { businessName: "Ibadan Foodstuff Exchange", slug: "ibadan-foodstuff-exchange", category: "food-beverage", addressLine1: "Bodija Market", city: "Ibadan", state: "Oyo", latitude: 7.3964, longitude: 3.9167, rating: 4.1, products: [...PROVISIONS, "emzorPcm"] },
  { businessName: "Wuse Central Pharmacy", slug: "wuse-central-pharmacy", category: "healthcare", addressLine1: "Aminu Kano Crescent, Wuse 2", city: "Abuja", state: "FCT", latitude: 9.07, longitude: 7.47, rating: 4.6, products: [...HEALTH, "insulin", "firstAid"] },
  { businessName: "Garki Safety & Emergency", slug: "garki-safety-emergency", category: "emergency", addressLine1: "Area 11, Garki", city: "Abuja", state: "FCT", latitude: 9.035, longitude: 7.49, rating: 4.3, products: ["extinguisher", "firstAid", "coverall", "gasCylinder", "batteries"] },
  { businessName: "Kano Sabon Gari Traders", slug: "kano-sabon-gari-traders", category: "everyday", addressLine1: "Sabon Gari Market", city: "Kano", state: "Kano", latitude: 12.0, longitude: 8.5167, rating: 4.0, products: [...PROVISIONS, "paracetamol", "a4Paper", "batteries"] },
];

/** Small stable hash so each vendor/product pair gets the same numbers every run. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function stockStatus(quantity: number) {
  return quantity === 0 ? "OUT_OF_STOCK" : quantity <= 10 ? "LOW_STOCK" : "IN_STOCK";
}

export async function seedProximityVendors(prisma: PrismaClient, passwordHash: string) {
  const categories = new Map(
    (await prisma.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
  );

  for (const [index, v] of SEED_VENDORS.entries()) {
    const email = `${v.slug}@seed.finder.network`;
    const phone = `+23480${String(10000000 + index).padStart(8, "0")}`;
    const status = v.status ?? "VERIFIED";

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash, fullName: v.businessName, phone, role: "VENDOR", emailVerified: true },
    });

    const location = {
      addressLine1: v.addressLine1,
      city: v.city,
      state: v.state,
      country: "Nigeria",
      latitude: v.latitude,
      longitude: v.longitude,
    };

    const vendor = await prisma.vendor.upsert({
      where: { userId: user.id },
      update: { ...location, status, verifiedAt: status === "VERIFIED" ? new Date() : null },
      create: {
        userId: user.id,
        businessName: v.businessName,
        slug: v.slug,
        description: `${v.businessName} — live stock on Finder.`,
        categoryId: categories.get(v.category) ?? null,
        contactEmail: email,
        contactPhone: phone,
        status,
        verifiedAt: status === "VERIFIED" ? new Date() : null,
        rating: v.rating,
        reviewCount: Math.round(v.rating * 20),
        ...location,
      },
    });

    for (const key of v.products) {
      const p = PRODUCTS[key];
      const h = hash(`${v.slug}:${key}`);
      // ±15% around the base price, rounded to the nearest ₦50.
      const price = Math.round((p.basePrice * (0.85 + (h % 31) / 100)) / 50) * 50;
      // Mostly healthy stock, with roughly one in eight items running low.
      const quantity = h % 8 === 0 ? 3 + (h % 7) : 15 + (h % 400);
      const itemStatus = stockStatus(quantity);

      await prisma.inventoryItem.upsert({
        where: { vendorId_sku: { vendorId: vendor.id, sku: p.sku } },
        update: { name: p.name, quantity, price: price.toFixed(2), status: itemStatus },
        create: {
          vendorId: vendor.id,
          categoryId: categories.get(p.category) ?? null,
          name: p.name,
          sku: p.sku,
          quantity,
          unit: p.unit,
          price: price.toFixed(2),
          currency: "NGN",
          status: itemStatus,
          lastSyncedAt: new Date(),
        },
      });
    }
  }

  return SEED_VENDORS.length;
}
