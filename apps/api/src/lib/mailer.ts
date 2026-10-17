import { env } from "../env";
import { logger } from "./logger";

/**
 * Minimal transactional email client over Resend's HTTP API.
 * https://resend.com/docs/api-reference/emails/send-email
 *
 * Delivery failures are logged, never thrown: a flaky mail provider must not
 * turn sign-up into a 500, and /forgot-password must respond identically
 * whether or not an account exists.
 */

const RESEND_URL = "https://api.resend.com/emails";

export const emailEnabled = () => env.email.apiKey.length > 0;

export type Mail = { to: string; subject: string; html: string; text: string };

/** Returns true when the provider accepted the message. */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (!emailEnabled()) return false;

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.email.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.email.from,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
    });

    if (!res.ok) {
      logger.error(`Email send failed (${res.status}): ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    logger.error(`Email send failed: ${(err as Error).message}`);
    return false;
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function layout(heading: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f6f4;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1a1a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:12px;padding:32px">
<tr><td>
<p style="margin:0 0 4px;font-size:13px;color:#777">Finder Network</p>
<h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(heading)}</h1>
${bodyHtml}
<p style="margin:24px 0 0;font-size:12px;color:#999">If you did not request this, you can ignore this email.</p>
</td></tr></table></td></tr></table></body></html>`;
}

export function verificationEmail(name: string, code: string): Omit<Mail, "to"> {
  const first = escapeHtml(name.split(" ")[0] || "there");
  return {
    subject: `${code} is your Finder verification code`,
    text: `Hi ${name.split(" ")[0] || "there"},\n\nYour Finder Network verification code is ${code}. It expires in 24 hours.\n\nIf you did not request this, you can ignore this email.`,
    html: layout(
      "Verify your email",
      `<p style="margin:0 0 16px;line-height:1.5">Hi ${first}, enter this code to verify your email. It expires in 24 hours.</p>
<p style="margin:0;font-size:32px;font-weight:700;letter-spacing:8px">${escapeHtml(code)}</p>`,
    ),
  };
}

export function passwordResetEmail(name: string, link: string): Omit<Mail, "to"> {
  const first = escapeHtml(name.split(" ")[0] || "there");
  const safeLink = escapeHtml(link);
  return {
    subject: "Reset your Finder password",
    text: `Hi ${name.split(" ")[0] || "there"},\n\nUse this link to choose a new password. It expires in 1 hour:\n${link}\n\nIf you did not request this, you can ignore this email.`,
    html: layout(
      "Reset your password",
      `<p style="margin:0 0 16px;line-height:1.5">Hi ${first}, use the button below to choose a new password. The link expires in 1 hour.</p>
<p style="margin:0"><a href="${safeLink}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px">Reset password</a></p>`,
    ),
  };
}
