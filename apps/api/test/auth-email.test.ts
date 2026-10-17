import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../src/env";
import { prisma } from "../src/lib/prisma";
import { consumeResetToken, consumeUserCode, issueAuthToken } from "../src/services/auth.service";
import { passwordResetEmail, verificationEmail } from "../src/lib/mailer";
import { makeUser, resetDb } from "./factories";

const HOUR = 3_600_000;
const mutableEmail = env.email as { apiKey: string };

const fetchMock = vi.fn();

beforeEach(async () => {
  await resetDb();
  fetchMock.mockReset().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  mutableEmail.apiKey = "re_test_key";
});

afterEach(() => {
  mutableEmail.apiKey = "";
  vi.unstubAllGlobals();
});

const sentMail = () => JSON.parse(fetchMock.mock.calls[0]![1].body as string);

describe("verification codes", () => {
  it("emails a six-digit code to the user, and the code works once", async () => {
    const user = await makeUser({ email: "ada@test.dev" });

    const code = await issueAuthToken(user.id, "EMAIL_VERIFICATION", 24 * HOUR);

    expect(code).toMatch(/^\d{6}$/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.resend.com/emails");
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe("Bearer re_test_key");
    const mail = sentMail();
    expect(mail.to).toEqual(["ada@test.dev"]);
    expect(mail.subject).toContain(code);
    expect(mail.text).toContain(code);

    await expect(consumeUserCode(user.id, code, "EMAIL_VERIFICATION")).resolves.toBeUndefined();
    await expect(consumeUserCode(user.id, code, "EMAIL_VERIFICATION")).rejects.toMatchObject({ status: 401 });
  });

  it("invalidates the previous code when a new one is issued", async () => {
    const user = await makeUser();
    const first = await issueAuthToken(user.id, "EMAIL_VERIFICATION", HOUR);
    let second = await issueAuthToken(user.id, "EMAIL_VERIFICATION", HOUR);
    while (second === first) second = await issueAuthToken(user.id, "EMAIL_VERIFICATION", HOUR);

    await expect(consumeUserCode(user.id, first, "EMAIL_VERIFICATION")).rejects.toMatchObject({ status: 401 });
    await expect(consumeUserCode(user.id, second, "EMAIL_VERIFICATION")).resolves.toBeUndefined();
  });

  it("rejects an expired code and another user's code", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const expired = await issueAuthToken(a.id, "EMAIL_VERIFICATION", -1000);
    await expect(consumeUserCode(a.id, expired, "EMAIL_VERIFICATION")).rejects.toMatchObject({ status: 401 });

    const live = await issueAuthToken(a.id, "EMAIL_VERIFICATION", HOUR);
    await expect(consumeUserCode(b.id, live, "EMAIL_VERIFICATION")).rejects.toMatchObject({ status: 401 });
  });
});

describe("password reset links", () => {
  it("emails a link containing a single-use token", async () => {
    const user = await makeUser({ email: "grace@test.dev" });

    const token = await issueAuthToken(user.id, "PASSWORD_RESET", HOUR);

    const mail = sentMail();
    expect(mail.to).toEqual(["grace@test.dev"]);
    expect(mail.text).toContain(`${env.webUrl}/reset-password?token=${token}`);
    await expect(consumeResetToken(token)).resolves.toBe(user.id);
    await expect(consumeResetToken(token)).rejects.toMatchObject({ status: 401 });
  });

  it("does not store the plaintext token", async () => {
    const user = await makeUser();
    const token = await issueAuthToken(user.id, "PASSWORD_RESET", HOUR);
    const rows = await prisma.authToken.findMany();
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it("rejects a token nobody issued", async () => {
    await expect(consumeResetToken("not-a-real-token")).rejects.toMatchObject({ status: 401 });
  });
});

describe("delivery failures", () => {
  it("still issues the code when the provider returns an error", async () => {
    const user = await makeUser();
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    const code = await issueAuthToken(user.id, "EMAIL_VERIFICATION", HOUR);
    await expect(consumeUserCode(user.id, code, "EMAIL_VERIFICATION")).resolves.toBeUndefined();
  });

  it("still issues the code when the network call throws", async () => {
    const user = await makeUser();
    fetchMock.mockRejectedValue(new Error("network down"));
    await expect(issueAuthToken(user.id, "PASSWORD_RESET", HOUR)).resolves.toBeTruthy();
  });

  it("sends nothing when no API key is configured", async () => {
    mutableEmail.apiKey = "";
    const user = await makeUser();
    await issueAuthToken(user.id, "EMAIL_VERIFICATION", HOUR);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("email templates", () => {
  it("escapes the user's name in the HTML body", () => {
    const { html } = verificationEmail('<script>alert(1)</script> Ada', "123456");
    expect(html).not.toContain("<script>");
    expect(html).toContain("123456");
  });

  it("escapes the reset link in the HTML body", () => {
    const { html } = passwordResetEmail("Ada", 'https://x.test/?a="><img src=x>');
    expect(html).not.toContain("<img");
  });
});
