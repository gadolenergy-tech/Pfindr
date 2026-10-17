import { z } from "zod";
import { apiKeyScopeSchema } from "./enums.js";

export const createApiKeySchema = z.object({
  name: z.string().min(2, "Name this key").max(120),
  scopes: z.array(apiKeyScopeSchema).min(1, "Pick at least one scope"),
  expiresAt: z.string().datetime().optional().nullable(),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

/**
 * The plaintext key is returned exactly once, at creation. Everything after
 * that only ever sees `keyPrefix`.
 */
export const createdApiKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(),
  keyPrefix: z.string(),
  scopes: z.array(apiKeyScopeSchema),
  createdAt: z.string(),
});
export type CreatedApiKey = z.infer<typeof createdApiKeySchema>;
