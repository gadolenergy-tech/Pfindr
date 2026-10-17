import { Router } from "express";
import { createApiKeySchema, type CreateApiKeyInput } from "@finder/shared";
import { prisma } from "../lib/prisma";
import { created, ok } from "../lib/respond";
import { validateBody } from "../middleware/validate";
import { requireAuth, requireVendor, vendorIdOf } from "../middleware/auth";
import { badRequest, notFound } from "../lib/errors";
import { generateApiKey } from "../middleware/api-key";

/** Session-authenticated key management for /vendor/api-integrations. */
const router = Router();

router.use(requireAuth, requireVendor);

const MAX_ACTIVE_KEYS = 10;

const publicFields = {
  id: true,
  name: true,
  keyPrefix: true,
  scopes: true,
  lastUsedAt: true,
  expiresAt: true,
  revokedAt: true,
  createdAt: true,
} as const;

router.get("/", async (req, res) => {
  const keys = await prisma.apiKey.findMany({
    where: { vendorId: vendorIdOf(req) },
    select: publicFields,
    orderBy: [{ revokedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
  });
  return ok(res, keys);
});

/** The only response that ever contains the plaintext key. */
router.post("/", validateBody(createApiKeySchema), async (req, res) => {
  const vendorId = vendorIdOf(req);
  const input = req.body as CreateApiKeyInput;

  const active = await prisma.apiKey.count({ where: { vendorId, revokedAt: null } });
  if (active >= MAX_ACTIVE_KEYS) {
    throw badRequest(`You can have at most ${MAX_ACTIVE_KEYS} active keys — revoke one first`);
  }

  const { key, keyPrefix, keyHash } = generateApiKey();
  const record = await prisma.apiKey.create({
    data: {
      vendorId,
      name: input.name,
      keyPrefix,
      keyHash,
      scopes: [...new Set(input.scopes)],
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    },
    select: publicFields,
  });

  return created(res, { ...record, key });
});

router.delete("/:id", async (req, res) => {
  const key = await prisma.apiKey.findFirst({
    where: { id: req.params.id, vendorId: vendorIdOf(req) },
    select: { id: true, revokedAt: true },
  });
  if (!key) throw notFound("No such API key");
  if (!key.revokedAt) {
    await prisma.apiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });
  }
  return ok(res, { revoked: true });
});

export default router;
