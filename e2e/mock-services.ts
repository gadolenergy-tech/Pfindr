/**
 * Local stand-ins for the two third parties the app talks to, so the suite can
 * exercise photo uploads and Buy now without real credentials or network:
 *
 *  - S3: accepts a presigned PUT and serves the object back on GET, on the same
 *    path, so the API's presigned URL and the public URL are one and the same.
 *  - Paystack: /transaction/initialize and /transaction/verify/:ref. Tests flip a
 *    transaction to paid through POST /__pay/:ref, as a buyer finishing on the
 *    hosted payment page would.
 */
import http from "node:http";
import { MOCK_PORT, MOCK_URL } from "./env";

const objects = new Map<string, { type: string; body: Buffer }>();
const transactions = new Map<string, { amount: number; currency: string; email: string; paid: boolean; paidAt?: string }>();

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,PUT,POST,OPTIONS",
  "access-control-allow-headers": "*",
};

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json", ...CORS });
  res.end(JSON.stringify(body));
}

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", MOCK_URL);
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }
  if (path === "/__health") return json(res, 200, { ok: true });

  // ---- S3 ----
  if (path.startsWith("/e2e-bucket/")) {
    if (req.method === "PUT") {
      objects.set(path, { type: String(req.headers["content-type"] ?? "application/octet-stream"), body: await readBody(req) });
      res.writeHead(200, CORS);
      return res.end();
    }
    if (req.method === "GET") {
      const hit = objects.get(path);
      if (!hit) return json(res, 404, { error: "no such object" });
      res.writeHead(200, { "content-type": hit.type, ...CORS });
      return res.end(hit.body);
    }
  }
  if (path === "/__objects") return json(res, 200, { keys: [...objects.keys()] });

  // ---- Paystack ----
  if (req.method === "POST" && path === "/transaction/initialize") {
    const input = JSON.parse((await readBody(req)).toString()) as { email: string; amount: number; currency: string; reference: string };
    transactions.set(input.reference, { amount: input.amount, currency: input.currency, email: input.email, paid: false });
    return json(res, 200, {
      status: true,
      message: "Authorization URL created",
      data: { authorization_url: `${MOCK_URL}/pay/${input.reference}`, access_code: "ac_e2e", reference: input.reference },
    });
  }
  const verify = path.match(/^\/transaction\/verify\/(.+)$/);
  if (req.method === "GET" && verify) {
    const ref = decodeURIComponent(verify[1]!);
    const tx = transactions.get(ref);
    if (!tx) return json(res, 404, { status: false, message: "Transaction reference not found" });
    return json(res, 200, {
      status: true,
      message: "Verification successful",
      data: {
        status: tx.paid ? "success" : "abandoned",
        reference: ref,
        amount: tx.amount,
        currency: tx.currency,
        paid_at: tx.paidAt ?? null,
      },
    });
  }
  const pay = path.match(/^\/__pay\/(.+)$/);
  if (req.method === "POST" && pay) {
    const ref = decodeURIComponent(pay[1]!);
    const tx = transactions.get(ref);
    if (!tx) return json(res, 404, { error: "unknown reference" });
    tx.paid = true;
    tx.paidAt = new Date().toISOString();
    return json(res, 200, { ok: true, reference: ref, amount: tx.amount });
  }
  // The hosted payment page a buyer lands on.
  if (req.method === "GET" && path.startsWith("/pay/")) {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(`<!doctype html><title>Mock Paystack</title><h1 id="mock-paystack">Mock Paystack checkout</h1><p id="ref">${path.slice(5)}</p>`);
  }

  json(res, 404, { error: `mock: no route for ${req.method} ${path}` });
});

server.listen(MOCK_PORT, "127.0.0.1", () => console.log(`mock services on ${MOCK_URL}`));
