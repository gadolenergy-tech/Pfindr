import { Router } from "express";
import { presignUploadSchema, type PresignUploadInput } from "@finder/shared";
import { ok } from "../lib/respond";
import { createUploadUrl } from "../lib/storage";
import { requireAuth, requireVendor, vendorIdOf } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

const router = Router();

/** Returns a short-lived URL the browser PUTs an image to directly. */
router.post("/uploads/presign", requireAuth, requireVendor, validateBody(presignUploadSchema), async (req, res) => {
  return ok(res, await createUploadUrl(vendorIdOf(req), req.body as PresignUploadInput));
});

export default router;
