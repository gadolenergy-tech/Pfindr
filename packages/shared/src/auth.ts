import { z } from "zod";
import { roleSchema } from "./enums.js";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[0-9]/, "Must contain a number");

export const emailSchema = z.string().email("Enter a valid email").max(254);

export const registerSchema = z.object({
  fullName: z.string().min(2, "Enter your full name").max(120),
  email: emailSchema,
  phone: z.string().min(7).max(20).optional().nullable(),
  password: passwordSchema,
  /** Vendors register through /vendor/signup, which posts role: "VENDOR". */
  role: roleSchema.exclude(["ADMIN"]).default("USER"),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string().min(1),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({
  /** Six-digit code from the verification email. Scoped to the signed-in user. */
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string().min(1),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Shape returned by /auth/me and embedded in the access token payload. */
export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  fullName: z.string(),
  phone: z.string().nullable(),
  role: roleSchema,
  emailVerified: z.boolean(),
  avatarUrl: z.string().nullable(),
  vendorId: z.string().nullable(),
  createdAt: z.string(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: SessionUser["role"];
  vendorId: string | null;
};
