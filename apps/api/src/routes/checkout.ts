import { Router, type Request } from "express";
import { createCheckoutSchema, type CreateCheckoutInput } from "@finder/shared";
import { created, ok } from "../lib/respond";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { logger } from "../lib/logger";
import { isValidWebhookSignature, paymentsEnabled } from "../lib/paystack";
import {
  confirmCheckout,
  getPurchase,
  listPurchases,
  returnOrigin,
  serializePurchase,
  startCheckout,
} from "../services/checkout.service";

const router = Router();

/** Buy now: reserves the stock and returns Paystack's payment page URL. */
router.post("/checkout", requireAuth, validateBody(createCheckoutSchema), async (req, res) => {
  const auth = req.auth!;
  const started = await startCheckout(
    { userId: auth.sub, email: auth.email, vendorId: auth.vendorId },
    req.body as CreateCheckoutInput,
    returnOrigin(req.headers.origin),
  );
  return created(res, started);
});

/**
 * The return page polls this after Paystack redirects back. It confirms the
 * payment with Paystack itself, so it works even before the webhook arrives.
 */
router.get("/checkout/:reference", requireAuth, async (req, res) => {
  const reference = req.params.reference!;
  let session = await getPurchase(req.auth!.sub, reference);
  if ((session.status === "PENDING" || session.status === "EXPIRED") && paymentsEnabled()) {
    await confirmCheckout(reference);
    session = await getPurchase(req.auth!.sub, reference);
  }
  return ok(res, serializePurchase(session));
});

/** The signed-in buyer's purchases, newest first. */
router.get("/purchases", requireAuth, async (req, res) => {
  const rows = await listPurchases(req.auth!.sub);
  return ok(res, rows.map(serializePurchase));
});

/**
 * Paystack's server-to-server notice. Always answers 200 once the signature
 * checks out, so Paystack does not retry forever over our own errors.
 */
router.post("/webhooks/paystack", async (req, res) => {
  const signature = req.headers["x-paystack-signature"];
  const { rawBody } = req as Request & { rawBody?: Buffer };
  if (!rawBody || !isValidWebhookSignature(rawBody, typeof signature === "string" ? signature : undefined)) {
    return res.status(401).json({ ok: false, error: { code: "BAD_SIGNATURE", message: "Invalid signature" } });
  }
  const event = req.body as { event?: string; data?: { reference?: string } };
  if (event.event === "charge.success" && event.data?.reference?.startsWith("FND-")) {
    await confirmCheckout(event.data.reference).catch((err: unknown) =>
      logger.error(`paystack webhook ${event.data?.reference}: ${String(err)}`),
    );
  }
  return res.status(200).json({ ok: true });
});

export default router;
