import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { jwtSecretProblem } from "../src/env";
import { createApp } from "../src/app";

const STRONG_A = "k3J9xQ2mZp7vB1nR8tYw4uHc6aDf0sLe5gXiOq";
const STRONG_B = "Zp0aW8sNd3VbT6yUj1KcE9hRm4LxQf7oIg2BtY";

describe("jwtSecretProblem", () => {
  it("accepts two different long random secrets", () => {
    expect(jwtSecretProblem(STRONG_A, STRONG_B)).toBeNull();
  });

  it("rejects the placeholders from .env.example", () => {
    expect(jwtSecretProblem("change-me-access", "change-me-refresh")).toMatch(/JWT_ACCESS_SECRET/);
  });

  it("rejects short secrets and placeholder words even when long", () => {
    expect(jwtSecretProblem("short", STRONG_B)).toMatch(/JWT_ACCESS_SECRET/);
    expect(jwtSecretProblem(STRONG_A, "x".repeat(10))).toMatch(/JWT_REFRESH_SECRET/);
    expect(jwtSecretProblem("my-super-secret-value-that-is-long-enough-0000", STRONG_B)).toMatch(/JWT_ACCESS_SECRET/);
  });

  it("rejects reusing one secret for both tokens", () => {
    expect(jwtSecretProblem(STRONG_A, STRONG_A)).toMatch(/different/);
  });
});

describe("HTTP hardening", () => {
  let server: http.Server;
  let base: string;

  beforeAll(async () => {
    server = http.createServer(createApp());
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it("sends security headers and does not advertise Express", async () => {
    const res = await fetch(`${base}/api/healthz`);
    expect(res.headers.get("x-powered-by")).toBeNull();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("strict-transport-security")).toBeTruthy();
  });

  it("rejects protected routes without a session", async () => {
    for (const path of ["/inventory", "/orders", "/customers", "/conversations", "/api-keys", "/admin/stats", "/purchases"]) {
      expect((await fetch(`${base}/api${path}`)).status, path).toBe(401);
    }
  });

  it("rate-limits repeated login attempts per client IP, not globally", async () => {
    const attempt = (ip: string) =>
      fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
        body: JSON.stringify({ email: "nobody@test.dev", password: "wrong-password" }),
      });

    let blocked = 0;
    for (let i = 0; i < 25; i++) if ((await attempt("203.0.113.7")).status === 429) blocked++;
    expect(blocked).toBeGreaterThan(0);
    // A different visitor is unaffected by the first one's lockout.
    expect((await attempt("203.0.113.99")).status).not.toBe(429);
  });
});
