# Deploying Finder Network

Target: the two Next.js apps on **Vercel**, the Express API and Postgres on
**Railway**. Nothing here has been deployed yet — treat the first run as the
test of this document and fix it as you go.

```
browser ──► Vercel: web (finder.example.com)   ──┐  /api/proxy/*  (server-side, same origin)
browser ──► Vercel: admin (admin.example.com)  ──┤
                                                 ▼
                                        Railway: API ──► Railway: Postgres
                                                 │
                                                 ├──► Paystack (payments + webhook)
                                                 ├──► Resend (email)
                                                 └──► R2/S3 (image uploads, browser PUTs directly)
```

The browser only ever talks to its own Vercel app. `/api/proxy` forwards to the
API with the httpOnly auth cookies, so the API needs no cross-site cookies.

## 1. Railway: database and API

1. New project → add **PostgreSQL**.
2. Add a service from this GitHub repo. Leave **Root Directory** at the repo root
   (the workspaces need it); Railway picks up `railway.json` from there.
   That file builds the shared package and API, and its start command runs
   `prisma migrate deploy` before the server boots, so a failed migration fails
   the deploy instead of serving a broken schema. It health-checks `/api/healthz`.
   (Railway ignored a separate `preDeployCommand` here, so migrations live in
   the start command.)
3. Set the variables below, using the Postgres service's `DATABASE_URL`
   (reference it as `${{Postgres.DATABASE_URL}}`).

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | from the Postgres service |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | two different random strings, 32+ chars (`openssl rand -base64 48`). The API refuses to start with placeholders. |
| `WEB_URL` | the public web URL, e.g. `https://finder.example.com`. Used in reset links and as the Paystack return fallback. |
| `CORS_ORIGINS` | web and admin origins, comma-separated |
| `TRUST_PROXY_HOPS` | `2` (Railway's internal proxy + its edge, which appends the caller's address to `X-Forwarded-For`) |
| `PROXY_SHARED_SECRET` | 32+ random characters (`openssl rand -hex 32`), **identical** to the same variable on both Vercel projects. Lets the API rate-limit by real visitor IP; see below. |
| `PAYSTACK_SECRET_KEY` | `sk_live_…` (use `sk_test_…` on staging) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend key, and a sender on a **verified domain** |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` | see below |
| `PLATFORM_FEE_PERCENT` | Finder's cut, e.g. `5`. `0` until decided. |
| `LOG_LEVEL` | `info` |

4. After the first successful deploy, create the categories and your admin
   **once** (Railway shell, or locally with the production `DATABASE_URL`):

   ```bash
   ADMIN_EMAIL=you@company.com ADMIN_PASSWORD='a long passphrase' \
     npm run db:bootstrap --workspace @finder/api
   ```

   **Never run `db:seed` in production** — it creates accounts with a published
   password. It refuses to run when `NODE_ENV=production`.

## 2. Vercel: web and admin

Create **two projects** from the same repo.

| | web | admin |
| --- | --- | --- |
| Root Directory | `apps/web` | `apps/admin` |
| Framework | Next.js | Next.js |
| `API_URL` | the Railway API's public URL | same |
| `NEXT_PUBLIC_APP_URL` | its own public URL | its own public URL |
| `NEXT_PUBLIC_API_URL` | the Railway API's public URL (shown in developer docs) | — |
| `PROXY_SHARED_SECRET` | same value as on the API | same value as on the API |

Leave "Include source files outside of the Root Directory" **on**: both apps
import `packages/shared`, which the root `postinstall` builds.

### Why PROXY_SHARED_SECRET exists

Railway's edge appends the address that connected to it to `X-Forwarded-For`,
and `TRUST_PROXY_HOPS=2` makes the API use that address. Behind Vercel that is
a Vercel server, so without help the API sees every visitor as one of a few
Vercel IPs and they all share rate-limit buckets (about 20 failed logins would
lock everyone out). The web and admin
`/api/proxy` therefore pass the visitor's real IP in `x-finder-client-ip`
together with this secret, and the API believes that header only when the secret
matches. Without it (or with a wrong one) the header is ignored, so nobody can
pick their own IP. Leave it empty locally.

## 3. Image storage (R2 or S3)

- Make the bucket publicly readable (or put a CDN in front) and set
  `S3_PUBLIC_URL` to that base URL, no trailing slash.
- Add a CORS rule so browsers can upload directly:

  ```json
  [{ "AllowedOrigins": ["https://finder.example.com"],
     "AllowedMethods": ["PUT"],
     "AllowedHeaders": ["*"],
     "MaxAgeSeconds": 3600 }]
  ```

- R2: `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `S3_REGION=auto`.
  AWS S3: leave `S3_ENDPOINT` empty and set the real `S3_REGION`.

## 4. Paystack

- Webhook URL (Settings → API Keys & Webhooks):
  `https://<web origin>/api/proxy/webhooks/paystack`
- Live mode needs Paystack's business verification — **start it now**, it is the
  step most likely to delay launch.
- Payouts to vendors are manual: send a bank transfer, then record it in the
  admin console under **Payouts**.

## 5. Email

Add and verify your sending domain in Resend (SPF/DKIM DNS records) and set
`EMAIL_FROM` to an address on it. The default `onboarding@resend.dev` sender only
delivers to the Resend account owner.

## 6. Smoke test after every first deploy

- [ ] `GET <api>/api/healthz` reports `healthy`, `database: up`
- [ ] Sign up a buyer; the verification email arrives; the code verifies
- [ ] "Forgot password" email arrives and the link resets the password
- [ ] Sign up a vendor; approve it in the admin console; upload a logo
- [ ] Add a product with a photo; it appears in search
- [ ] Buy it with a Paystack **test** card; an order and a vendor message appear
- [ ] Re-send the Paystack webhook; no second order is created
- [ ] Record a payout in admin → Payouts; the owed balance drops
- [ ] Hit `/api/auth/login` repeatedly from two networks; only the abusive one gets 429
- [ ] API logs show visitors' real IPs, not `54.x`/`3.x` Vercel addresses
