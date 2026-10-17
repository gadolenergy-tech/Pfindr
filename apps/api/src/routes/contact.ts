import { Router } from "express";
import rateLimit from "express-rate-limit";
import { contactSubmissionSchema, partnerInquirySchema } from "@finder/shared";
import { prisma } from "../lib/prisma";
import { created } from "../lib/respond";
import { validateBody } from "../middleware/validate";

const router = Router();

// Public, unauthenticated forms — keep them cheap to abuse.
const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

router.post(
  "/contact",
  formLimiter,
  validateBody(contactSubmissionSchema),
  async (req, res) => {
    const submission = await prisma.contactSubmission.create({
      data: {
        fullName: req.body.fullName,
        email: req.body.email.toLowerCase(),
        company: req.body.company ?? null,
        subject: req.body.subject,
        message: req.body.message,
      },
      select: { id: true, createdAt: true },
    });
    return created(res, submission);
  },
);

router.post(
  "/partners/inquiries",
  formLimiter,
  validateBody(partnerInquirySchema),
  async (req, res) => {
    const partner = await prisma.partner.create({
      data: {
        companyName: req.body.companyName,
        contactName: req.body.contactName,
        contactEmail: req.body.contactEmail.toLowerCase(),
        contactPhone: req.body.contactPhone ?? null,
        website: req.body.website || null,
        partnershipType: req.body.partnershipType,
        message: req.body.message,
      },
      select: { id: true, createdAt: true },
    });
    return created(res, partner);
  },
);

export default router;
