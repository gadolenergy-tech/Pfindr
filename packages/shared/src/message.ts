import { z } from "zod";
import { paginationQuerySchema } from "./common.js";

export const createConversationSchema = z.object({
  vendorId: z.string().min(1),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
});
export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const sendMessageSchema = z.object({
  body: z.string().min(1).max(5000),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const conversationQuerySchema = paginationQuerySchema.extend({
  unreadOnly: z.coerce.boolean().optional(),
});
export type ConversationQuery = z.infer<typeof conversationQuerySchema>;

/** Public "Contact Us" form — no auth required. */
export const contactSubmissionSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(254),
  company: z.string().max(160).optional().nullable(),
  subject: z.string().min(2).max(200),
  message: z.string().min(10, "Tell us a little more").max(5000),
});
export type ContactSubmissionInput = z.infer<typeof contactSubmissionSchema>;
