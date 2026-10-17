import { Router, type Request } from "express";
import type { Prisma } from "@prisma/client";
import {
  conversationQuerySchema,
  createConversationSchema,
  sendMessageSchema,
  type ConversationQuery,
  type CreateConversationInput,
} from "@finder/shared";
import { prisma } from "../lib/prisma";
import { created, ok, paginated } from "../lib/respond";
import { parsedQuery, validateBody, validateQuery } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { badRequest, forbidden, notFound } from "../lib/errors";

/**
 * Buyer ↔ vendor threads. Either party can read and reply; who they are in a
 * given thread is decided by the session, never by the request body:
 *   - the vendor side is whoever owns conversation.vendorId
 *   - the buyer side is conversation.userId
 * Each side has its own unread counter, so reading a thread only clears yours.
 */
const router = Router();

router.use(requireAuth);

type Side = "VENDOR" | "USER";

function sideIn(
  req: Request,
  conversation: { vendorId: string; userId: string | null },
): Side | null {
  if (req.auth?.vendorId && req.auth.vendorId === conversation.vendorId) return "VENDOR";
  if (conversation.userId && req.auth?.sub === conversation.userId) return "USER";
  return null;
}

const listInclude = {
  vendor: { select: { id: true, businessName: true, slug: true } },
  user: { select: { id: true, fullName: true, email: true } },
  messages: { orderBy: { createdAt: "desc" as const }, take: 1 },
} satisfies Prisma.ConversationInclude;

function serializeSummary(
  c: Prisma.ConversationGetPayload<{ include: typeof listInclude }>,
  side: Side,
) {
  const last = c.messages[0];
  return {
    id: c.id,
    subject: c.subject,
    side,
    // The other party, from the caller's point of view.
    counterpart:
      side === "VENDOR"
        ? { name: c.user?.fullName ?? "Finder buyer", email: c.user?.email ?? null }
        : { name: c.vendor.businessName, email: null },
    vendor: c.vendor,
    unread: side === "VENDOR" ? c.vendorUnread : c.userUnread,
    lastMessage: last
      ? {
          body: last.body.slice(0, 140),
          fromMe: last.senderType === side,
          createdAt: last.createdAt.toISOString(),
        }
      : null,
    lastMessageAt: c.lastMessageAt.toISOString(),
  };
}

/**
 * Inbox. A vendor sees threads addressed to their business; everyone sees the
 * threads they started as a buyer.
 */
router.get("/", validateQuery(conversationQuerySchema), async (req, res) => {
  const { page, limit, unreadOnly } = parsedQuery<ConversationQuery>(req);
  const vendorId = req.auth!.vendorId;
  const userId = req.auth!.sub;

  const scope: Prisma.ConversationWhereInput[] = [{ userId }];
  if (vendorId) scope.push({ vendorId });

  const where: Prisma.ConversationWhereInput = {
    archivedAt: null,
    OR: scope,
    ...(unreadOnly
      ? {
          AND: [
            {
              OR: [
                ...(vendorId ? [{ vendorId, vendorUnread: { gt: 0 } }] : []),
                { userId, userUnread: { gt: 0 } },
              ],
            },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: listInclude,
      orderBy: { lastMessageAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.conversation.count({ where }),
  ]);

  return paginated(
    res,
    rows.map((c) => serializeSummary(c, sideIn(req, c) ?? "USER")),
    { page, limit, total },
  );
});

router.get("/unread-count", async (req, res) => {
  const vendorId = req.auth!.vendorId;
  const [asVendor, asUser] = await Promise.all([
    vendorId
      ? prisma.conversation.aggregate({
          where: { vendorId, archivedAt: null },
          _sum: { vendorUnread: true },
        })
      : null,
    prisma.conversation.aggregate({
      where: { userId: req.auth!.sub, archivedAt: null },
      _sum: { userUnread: true },
    }),
  ]);
  return ok(res, {
    unread: (asVendor?._sum.vendorUnread ?? 0) + (asUser._sum.userUnread ?? 0),
  });
});

/** Opening a thread returns its messages and clears the caller's unread count. */
router.get("/:id", async (req, res) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: req.params.id },
    include: {
      vendor: { select: { id: true, businessName: true, slug: true } },
      user: { select: { id: true, fullName: true, email: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!conversation) throw notFound("No such conversation");
  const side = sideIn(req, conversation);
  if (!side) throw forbidden("This conversation is not yours");

  await prisma.$transaction([
    prisma.conversation.update({
      where: { id: conversation.id },
      data: side === "VENDOR" ? { vendorUnread: 0 } : { userUnread: 0 },
    }),
    prisma.message.updateMany({
      where: {
        conversationId: conversation.id,
        senderType: side === "VENDOR" ? "USER" : "VENDOR",
        readAt: null,
      },
      data: { readAt: new Date() },
    }),
  ]);

  return ok(res, {
    id: conversation.id,
    subject: conversation.subject,
    side,
    vendor: conversation.vendor,
    counterpart:
      side === "VENDOR"
        ? {
            name: conversation.user?.fullName ?? "Finder buyer",
            email: conversation.user?.email ?? null,
          }
        : { name: conversation.vendor.businessName, email: null },
    messages: conversation.messages.map((m) => ({
      id: m.id,
      body: m.body,
      fromMe: m.senderType === side,
      senderType: m.senderType,
      readAt: m.readAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

/**
 * A buyer opens a thread with a vendor — the search modal's Contact and
 * Request Quote buttons land here. Repeat enquiries with the same subject
 * reuse the open thread instead of starting a new one.
 */
router.post("/", validateBody(createConversationSchema), async (req, res) => {
  const input = req.body as CreateConversationInput;
  const userId = req.auth!.sub;

  const vendor = await prisma.vendor.findFirst({
    where: { id: input.vendorId, status: "VERIFIED" },
    select: { id: true },
  });
  if (!vendor) throw notFound("That vendor is not available");
  if (req.auth!.vendorId === vendor.id) {
    throw badRequest("You cannot message your own business");
  }

  const existing = await prisma.conversation.findFirst({
    where: { vendorId: vendor.id, userId, subject: input.subject, archivedAt: null },
    select: { id: true },
  });

  const now = new Date();
  const conversation = existing
    ? await prisma.conversation.update({
        where: { id: existing.id },
        data: {
          lastMessageAt: now,
          vendorUnread: { increment: 1 },
          messages: { create: { senderType: "USER", senderId: userId, body: input.body } },
        },
      })
    : await prisma.conversation.create({
        data: {
          vendorId: vendor.id,
          userId,
          subject: input.subject,
          lastMessageAt: now,
          vendorUnread: 1,
          messages: { create: { senderType: "USER", senderId: userId, body: input.body } },
        },
      });

  return created(res, { id: conversation.id, reused: Boolean(existing) });
});

router.post("/:id/messages", validateBody(sendMessageSchema), async (req, res) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: req.params.id },
    select: { id: true, vendorId: true, userId: true, archivedAt: true },
  });
  if (!conversation) throw notFound("No such conversation");
  const side = sideIn(req, conversation);
  if (!side) throw forbidden("This conversation is not yours");

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: side,
        senderId: req.auth!.sub,
        body: req.body.body,
      },
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        archivedAt: null, // a reply revives an archived thread
        ...(side === "VENDOR"
          ? { userUnread: { increment: 1 } }
          : { vendorUnread: { increment: 1 } }),
      },
    }),
  ]);

  return created(res, {
    id: message.id,
    body: message.body,
    fromMe: true,
    senderType: message.senderType,
    readAt: null,
    createdAt: message.createdAt.toISOString(),
  });
});

router.patch("/:id/archive", async (req, res) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: req.params.id },
    select: { id: true, vendorId: true, userId: true },
  });
  if (!conversation) throw notFound("No such conversation");
  if (!sideIn(req, conversation)) throw forbidden("This conversation is not yours");

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { archivedAt: new Date() },
  });
  return ok(res, { archived: true });
});

export default router;
