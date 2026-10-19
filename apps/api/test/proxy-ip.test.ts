import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { env } from "../src/env";
import { createApp } from "../src/app";
import { CLIENT_IP_HEADER, PROXY_SECRET_HEADER, proxiedClientIp } from "../src/lib/proxy-ip";

const SECRET = "a".repeat(8) + "b3f1c9d27e4a60581fd2c7a9e0b4d6f1c3e5a7b9d1f3";
const config = env as { proxySecret: string };

let server: http.Server;
let base: string;

beforeAll(async () => {
  config.proxySecret = SECRET;
  server = http.createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  config.proxySecret = "";
  await new Promise((resolve) => server.close(resolve));
});

/** One failed login, as the web app's proxy would forward it. */
const login = (headers: Record<string, string>) =>
  fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ email: "nobody@test.dev", password: "wrong-password" }),
  });

const viaProxy = (ip: string, secret = SECRET) => ({ [CLIENT_IP_HEADER]: ip, [PROXY_SECRET_HEADER]: secret });

/** Sends `n` attempts and returns how many were rate limited. */
async function blocked(n: number, headers: () => Record<string, string>) {
  let count = 0;
  for (let i = 0; i < n; i++) if ((await login(headers())).status === 429) count++;
  return count;
}

describe("proxiedClientIp", () => {
  const req = (headers: Record<string, string>) => ({ headers }) as unknown as Parameters<typeof proxiedClientIp>[0];

  it("returns the forwarded IP only when the secret matches", () => {
    expect(proxiedClientIp(req(viaProxy("203.0.113.5")))).toBe("203.0.113.5");
    expect(proxiedClientIp(req(viaProxy("2001:db8::1")))).toBe("2001:db8::1");
    expect(proxiedClientIp(req(viaProxy("203.0.113.5", "wrong")))).toBeNull();
    expect(proxiedClientIp(req({ [CLIENT_IP_HEADER]: "203.0.113.5" }))).toBeNull();
    expect(proxiedClientIp(req({ [PROXY_SECRET_HEADER]: SECRET }))).toBeNull();
  });

  it("ignores values that are not IP addresses", () => {
    for (const bad of ["not-an-ip", "1.2.3.4, 5.6.7.8", "", "999.1.1.1", "<script>"]) {
      expect(proxiedClientIp(req(viaProxy(bad))), bad).toBeNull();
    }
  });

  it("is disabled when the configured secret is missing or too short", () => {
    config.proxySecret = "";
    expect(proxiedClientIp(req(viaProxy("203.0.113.5", "")))).toBeNull();
    config.proxySecret = "short";
    expect(proxiedClientIp(req(viaProxy("203.0.113.5", "short")))).toBeNull();
    config.proxySecret = SECRET;
  });
});

describe("rate limiting behind the proxy", () => {
  it("limits each visitor separately, so one cannot lock out another", async () => {
    const noisy = "198.51.100.10";
    expect(await blocked(25, () => viaProxy(noisy))).toBeGreaterThan(0);

    // A different visitor, through the very same proxy connection, is unaffected.
    expect((await login(viaProxy("198.51.100.11"))).status).not.toBe(429);
    expect((await login(viaProxy("198.51.100.12"))).status).not.toBe(429);
    // And the noisy one is still blocked.
    expect((await login(viaProxy(noisy))).status).toBe(429);
  });

  it("does not let a caller dodge the limit by inventing IPs without the secret", async () => {
    let n = 0;
    const fake = () => ({ [CLIENT_IP_HEADER]: `192.0.2.${++n}`, [PROXY_SECRET_HEADER]: "not-the-secret" });
    // Every attempt claims a new address, but none is believed: they all share
    // the real connection's bucket and get cut off.
    expect(await blocked(25, fake)).toBeGreaterThan(0);
  });
  // Not tested here: a plain X-Forwarded-For. With TRUST_PROXY_HOPS=1 Express
  // believes the last entry, which is only safe because Railway's edge rewrites
  // the header with the address it really received the connection from (checked
  // by sending spoofed headers straight to the deployed API). A test that connects
  // directly, with no such edge in front, cannot say anything about that.
});
