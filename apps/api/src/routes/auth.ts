import { Router } from "express";
import rateLimit from "express-rate-limit";
import type {
  LoginInput,
  RegisterInput,
  VendorSignupInput,
} from "@finder/shared";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  vendorSignupSchema,
  verifyEmailSchema,
} from "@finder/shared";
import { prisma } from "../lib/prisma";
import { ok, created } from "../lib/respond";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { hashPassword, verifyPassword } from "../lib/password";
import {
  setAuthCookies,
  clearAuthCookies,
  REFRESH_COOKIE,
} from "../lib/cookies";
import { slugify, toSessionUser } from "../lib/serialize";
import { badRequest, notFound, unauthorized } from "../lib/errors";
import {
  assertEmailAvailable,
  consumeResetToken,
  consumeUserCode,
  issueAuthToken,
  issueSession,
  revokeAllSessions,
  revokeRefreshToken,
  rotateSession,
  userSelect,
} from "../services/auth.service";
import { attributeSignup, convertReferral } from "../services/affiliate.service";

const router = Router();

// Credential endpoints are the obvious brute-force target, so they get a
// tighter budget than the global limiter in app.ts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    ok: false,
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts — try again shortly",
    },
  },
});

const HOUR = 60 * 60 * 1000;

/** Makes "acme-foods" unique by appending -2, -3, ... when it is taken. */
async function uniqueVendorSlug(businessName: string): Promise<string> {
  const base = slugify(businessName) || "vendor";
  let slug = base;
  let suffix = 1;
  // Vendor counts are small; a short probe loop is fine here.
  while (
    await prisma.vendor.findUnique({ where: { slug }, select: { id: true } })
  ) {
    suffix += 1;
    slug = base + "-" + suffix;
  }
  return slug;
}

router.post(
  "/register",
  authLimiter,
  validateBody(registerSchema),
  async (req, res) => {
    const input = req.body as RegisterInput;
    await assertEmailAvailable(input.email);

    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: await hashPassword(input.password),
        fullName: input.fullName,
        phone: input.phone ?? null,
        role: input.role,
      },
      select: userSelect,
    });

    await attributeSignup(req, res, user.id, "USER");
    await issueAuthToken(user.id, "EMAIL_VERIFICATION", 24 * HOUR);
    const session = await issueSession(user, req);
    setAuthCookies(res, session);
    return created(res, { user: session.user });
  },
);

/** Vendor signup creates the User and its Vendor profile in one transaction. */
router.post(
  "/register/vendor",
  authLimiter,
  validateBody(vendorSignupSchema),
  async (req, res) => {
    const input = req.body as VendorSignupInput;
    await assertEmailAvailable(input.email);

    const category = await prisma.category.findUnique({
      where: { slug: input.categorySlug },
      select: { id: true },
    });

    const slug = await uniqueVendorSlug(input.businessName);
    const passwordHash = await hashPassword(input.password);

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash,
          fullName: input.fullName,
          phone: input.contactPhone,
          role: "VENDOR",
        },
      });

      await tx.vendor.create({
        data: {
          userId: createdUser.id,
          businessName: input.businessName,
          slug,
          description: input.description ?? null,
          categoryId: category?.id ?? null,
          contactEmail: input.contactEmail.toLowerCase(),
          contactPhone: input.contactPhone,
          website: input.website || null,
          // Uploads are scoped to a vendor id, which does not exist yet; the
          // logo is added from settings once the account is created.
          logoUrl: null,
          registrationNumber: input.registrationNumber ?? null,
          addressLine1: input.address.line1,
          addressLine2: input.address.line2 ?? null,
          city: input.address.city,
          state: input.address.state,
          country: input.address.country,
          postalCode: input.address.postalCode ?? null,
          latitude: input.address.latitude ?? null,
          longitude: input.address.longitude ?? null,
        },
      });

      return tx.user.findUniqueOrThrow({
        where: { id: createdUser.id },
        select: userSelect,
      });
    });

    await attributeSignup(req, res, user.id, "VENDOR");
    await issueAuthToken(user.id, "EMAIL_VERIFICATION", 24 * HOUR);
    const session = await issueSession(user, req);
    setAuthCookies(res, session);
    return created(res, { user: session.user });
  },
);

router.post(
  "/login",
  authLimiter,
  validateBody(loginSchema),
  async (req, res) => {
    const { email, password } = req.body as LoginInput;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { ...userSelect, passwordHash: true },
    });

    // Same message either way, so this cannot be used to enumerate emails.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw unauthorized("Email or password is incorrect");
    }
    if (user.status === "SUSPENDED") {
      throw unauthorized("This account has been suspended");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const session = await issueSession(user, req);
    setAuthCookies(res, session);
    return ok(res, { user: session.user });
  },
);

router.post("/refresh", async (req, res) => {
  const presented = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
  if (!presented) throw unauthorized("No session to refresh");

  const session = await rotateSession(presented, req);
  setAuthCookies(res, session);
  return ok(res, { user: session.user });
});

router.post("/logout", async (req, res) => {
  const presented = req.cookies?.[REFRESH_COOKIE];
  if (presented) await revokeRefreshToken(presented);
  clearAuthCookies(res);
  return ok(res, { loggedOut: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.sub },
    select: userSelect,
  });
  if (!user) throw notFound("Account no longer exists");
  return ok(res, { user: toSessionUser(user, user.vendor?.id ?? null) });
});

/** The code is scoped to the signed-in account, so this endpoint needs a session. */
router.post(
  "/verify-email",
  requireAuth,
  authLimiter,
  validateBody(verifyEmailSchema),
  async (req, res) => {
    const userId = req.auth!.sub;
    await consumeUserCode(userId, req.body.code, "EMAIL_VERIFICATION");
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
    if (req.auth!.role === "USER") await convertReferral(userId);
    return ok(res, { verified: true });
  },
);

router.post(
  "/verify-email/resend",
  requireAuth,
  authLimiter,
  async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.sub },
      select: { id: true, emailVerified: true },
    });
    if (!user) throw notFound("Account no longer exists");
    if (user.emailVerified) throw badRequest("That email is already verified");

    await issueAuthToken(user.id, "EMAIL_VERIFICATION", 24 * HOUR);
    return ok(res, { sent: true });
  },
);

router.post(
  "/forgot-password",
  authLimiter,
  validateBody(forgotPasswordSchema),
  async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { email: req.body.email.toLowerCase() },
      select: { id: true },
    });

    // Always the same response, so the form cannot confirm who has an account.
    if (user) await issueAuthToken(user.id, "PASSWORD_RESET", HOUR);
    return ok(res, {
      sent: true,
      message: "If that email is registered, a reset link is on its way",
    });
  },
);

router.post(
  "/reset-password",
  authLimiter,
  validateBody(resetPasswordSchema),
  async (req, res) => {
    const userId = await consumeResetToken(req.body.token);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(req.body.password) },
    });
    // A password change invalidates every existing device session.
    await revokeAllSessions(userId);
    clearAuthCookies(res);
    return ok(res, { reset: true });
  },
);

router.post(
  "/change-password",
  requireAuth,
  validateBody(changePasswordSchema),
  async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.sub },
      select: { id: true, passwordHash: true },
    });
    if (!user) throw notFound("Account no longer exists");

    if (!(await verifyPassword(req.body.currentPassword, user.passwordHash))) {
      throw unauthorized("Your current password is incorrect");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(req.body.password) },
    });
    await revokeAllSessions(user.id);
    clearAuthCookies(res);
    return ok(res, { changed: true });
  },
);

export default router;
