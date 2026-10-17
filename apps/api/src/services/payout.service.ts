import type { Prisma } from "@prisma/client";
import type {
  AdminVendorBalance,
  RecordPayoutInput,
  VendorBalance,
  VendorPayoutRecord,
} from "@finder/shared";
import { env } from "../env";
import { prisma } from "../lib/prisma";
import { badRequest, conflict, notFound } from "../lib/errors";
import { decimalToNumber } from "../lib/serialize";

/**
 * Buy now money lands in Finder's own Paystack account, and vendors are paid
 * out by hand (bank transfer). This is the ledger for that: what a vendor has
 * earned is derived from their paid, un-refunded checkout orders, and what has
 * been sent is the sum of the payouts an operator recorded. The balance is
 * never stored, so it cannot drift from the orders it comes from.
 *
 * Arithmetic is done in minor units (kobo) so rounding never leaks a cent.
 */

type Db = Prisma.TransactionClient | typeof prisma;

const toMinor = (n: number) => Math.round(n * 100);
const fromMinor = (n: number) => n / 100;

/** Orders whose money Finder is holding for the vendor. */
const earningOrders = {
  source: "CHECKOUT",
  paidAt: { not: null },
  status: { notIn: ["CANCELLED", "REFUNDED"] },
} satisfies Prisma.OrderWhereInput;

export async function computeBalances(
  db: Db,
  vendorId?: string,
): Promise<(VendorBalance & { vendorId: string })[]> {
  const scope = vendorId ? { vendorId } : {};
  const [orders, payouts] = await Promise.all([
    db.order.groupBy({
      by: ["vendorId", "currency"],
      where: { ...earningOrders, ...scope },
      _sum: { total: true },
    }),
    db.vendorPayout.groupBy({
      by: ["vendorId", "currency"],
      where: scope,
      _sum: { amount: true },
    }),
  ]);

  const rows = new Map<string, { vendorId: string; currency: string; gross: number; paidOut: number }>();
  const row = (v: string, c: string) => {
    const key = `${v}|${c}`;
    if (!rows.has(key)) rows.set(key, { vendorId: v, currency: c, gross: 0, paidOut: 0 });
    return rows.get(key)!;
  };
  for (const o of orders) row(o.vendorId, o.currency).gross = toMinor(decimalToNumber(o._sum.total));
  for (const p of payouts) row(p.vendorId, p.currency).paidOut = toMinor(decimalToNumber(p._sum.amount));

  return [...rows.values()].map((r) => {
    const fee = Math.round((r.gross * env.platformFeePercent) / 100);
    const earned = r.gross - fee;
    return {
      vendorId: r.vendorId,
      currency: r.currency,
      gross: fromMinor(r.gross),
      fee: fromMinor(fee),
      earned: fromMinor(earned),
      paidOut: fromMinor(r.paidOut),
      owed: fromMinor(earned - r.paidOut),
    };
  });
}

/** One vendor's balances, one entry per currency they have traded in. */
export async function vendorBalances(vendorId: string): Promise<VendorBalance[]> {
  const balances = await computeBalances(prisma, vendorId);
  return balances.map(({ vendorId: _v, ...rest }) => rest);
}

/** Every vendor Finder holds money for or has paid, biggest debt first. */
export async function adminBalances(): Promise<AdminVendorBalance[]> {
  const balances = await computeBalances(prisma);
  const vendors = await prisma.vendor.findMany({
    where: { id: { in: [...new Set(balances.map((b) => b.vendorId))] } },
    select: { id: true, businessName: true, contactEmail: true },
  });
  const byId = new Map(vendors.map((v) => [v.id, v]));
  return balances
    .map((b) => ({
      ...b,
      businessName: byId.get(b.vendorId)?.businessName ?? "Unknown vendor",
      contactEmail: byId.get(b.vendorId)?.contactEmail ?? "",
    }))
    .sort((a, b) => b.owed - a.owed);
}

const serialize = (p: {
  id: string;
  amount: Prisma.Decimal;
  currency: string;
  reference: string | null;
  note: string | null;
  paidAt: Date;
}): VendorPayoutRecord => ({
  id: p.id,
  amount: decimalToNumber(p.amount),
  currency: p.currency,
  reference: p.reference,
  note: p.note,
  paidAt: p.paidAt.toISOString(),
});

export async function listPayouts(vendorId: string): Promise<VendorPayoutRecord[]> {
  const rows = await prisma.vendorPayout.findMany({
    where: { vendorId },
    orderBy: { paidAt: "desc" },
    take: 100,
  });
  return rows.map(serialize);
}

/**
 * Records money already sent to a vendor. Refuses to record more than is owed
 * in that currency. The vendor row is locked for the transaction, so two
 * operators clicking "paid" at once cannot both settle the same balance.
 */
export async function recordPayout(actorId: string, vendorId: string, input: RecordPayoutInput) {
  const amountMinor = toMinor(input.amount);
  if (Math.abs(input.amount * 100 - amountMinor) > 1e-6) {
    throw badRequest("Amounts can have at most two decimal places");
  }

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } });
  if (!vendor) throw notFound("No such vendor");

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${vendorId}))`;

    const balance = (await computeBalances(tx, vendorId)).find((b) => b.currency === input.currency);
    const owedMinor = balance ? toMinor(balance.owed) : 0;
    if (amountMinor > owedMinor) {
      throw conflict(
        owedMinor > 0
          ? `Finder only owes this vendor ${fromMinor(owedMinor).toFixed(2)} ${input.currency}`
          : `Finder does not owe this vendor anything in ${input.currency}`,
      );
    }

    const payout = await tx.vendorPayout.create({
      data: {
        vendorId,
        amount: input.amount,
        currency: input.currency,
        reference: input.reference || null,
        note: input.note || null,
        createdById: actorId,
      },
    });
    return serialize(payout);
  });
}
