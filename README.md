# Finder Network

An AI-powered discovery network for physical inventory: search for a product,
material, medicine or piece of equipment and see what is in stock, how much, at
what price, and from the nearest vendor — in real time.

This monorepo is the refactor of the original Replit `finder-network` project
onto the standard stack (npm workspaces + Turborepo, Express + Prisma +
Postgres, Next.js App Router). The old repo remains at
`../finder-network` as a reference.

## Layout

```
apps/
  api/        Express 4 + Prisma 7 + PostgreSQL        :5020
  web/        Next.js 16 — public site + vendor portal :3020
  admin/      Next.js 16 — operator console            :3021
packages/
  shared/     Zod schemas + TypeScript types (built to dist/, consumed by all three)
```

## Getting started

Postgres runs locally (pgAdmin4, no Docker). On this machine the
`postgres/postgres` credential authenticates on **port 5433**.

```bash
npm install                 # also builds packages/shared via postinstall

cp .env.example .env
cp apps/api/.env.example    apps/api/.env
cp apps/web/.env.example    apps/web/.env.local
cp apps/admin/.env.example  apps/admin/.env.local

# Create the database once (pgAdmin4, or psql):
#   CREATE DATABASE finder_network;

npm run db:migrate          # apply the schema
npm run db:seed             # categories, an admin and a demo vendor

npm run dev                 # api + web + admin together
```

Seeded accounts (development only):

| Account                 | Password     | Role   |
| ----------------------- | ------------ | ------ |
| `admin@finder.network`  | `Finder123!` | ADMIN  |
| `vendor@finder.network` | `Finder123!` | VENDOR |

## Scripts

| Command              | What it does                                    |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | All three apps plus the shared package in watch  |
| `npm run build`      | Turbo build across the workspace                 |
| `npm run typecheck`  | `tsc --noEmit` everywhere                        |
| `npm run db:migrate` | `prisma migrate dev`, then `prisma generate`     |
| `npm run db:seed`    | Seed categories, admin, demo vendor              |
| `npm run db:studio`  | Prisma Studio on :5556                           |

## How auth works

Access and refresh tokens live in **httpOnly cookies**, never in
`localStorage`. The browser does not talk to the API directly — it calls
`/api/proxy/*` on its own Next app, which forwards to the API and passes
`Set-Cookie` back. Both hops are same-origin from the browser's point of view,
so JavaScript never touches a token.

- Access token: JWT, 15 minutes, verified on every protected route.
- Refresh token: opaque random string, 30 days, stored **hashed** in
  `refresh_tokens`. Logout, password reset and account suspension all work by
  revoking rows there, so a session can be killed server-side.
- Email verification uses a six-digit code scoped to the signed-in account.
  Password reset uses a long random link token that works with no session.
- `AuthGuard` in the Next apps only decides what renders. The API re-checks the
  token and role on every protected request — that is the real boundary.

## What is wired, and what is not

Everything the UI shows now comes from Postgres. Nothing on the vendor portal,
search, messaging, affiliate or admin surfaces renders hardcoded data.

| Area | State |
| --- | --- |
| Auth | Register (user and vendor), login, refresh rotation, logout, email verification (6-digit code), password reset, change password |
| Discovery search | Live `/discover`: verified, unpaused vendors only; distance ranking; trending terms; honours vendors' hide-price / hide-quantity settings |
| Inventory | CRUD, CSV bulk import, SKU sync, pause-all, delete-all, CSV export; stock status is derived server-side from quantity |
| Orders & customers | Vendor records orders against their own stock (decremented atomically; restocked on cancel/refund); customer totals tracked |
| Buy now (checkout) | Any priced search result → quantity, pickup/delivery, phone → Paystack. Stock is held for `CHECKOUT_HOLD_MINUTES` (30) and released if unpaid. The Order is created only once Paystack confirms payment (return page or webhook, idempotent), with a message in the vendor's inbox. Buyers track purchases at `/orders` |
| Messaging | Buyer ↔ vendor threads; "Message vendor" in search opens one; buyers read replies at `/messages`; polling, no sockets |
| Analytics | Search appearances, profile views, revenue, orders, conversion, top products, customer growth, rule-based recommendations |
| API keys & public API | Scoped, hashed, revocable keys; `/api/v1` search, inventory CRUD/sync/history, orders; 120 req/min per key |
| Affiliates | Instant join, `/r/[code]` links with 90-day cookie, attribution, conversion, tiers, payout requests |
| Settings | Profile, password, notification/privacy/default preferences (privacy + defaults enforced) |
| Admin | Vendor verification, user suspension, contact/partner triage, affiliate credit + payout settlement, audit log |

**Not built — each is labelled "Soon" in the UI rather than faked:**

- **Billing and vendor payouts.** Buy now payments land in Finder's Paystack
  account; paying vendors out is manual for now (Paystack subaccounts/splits
  would automate it). There are no vendor subscriptions, so affiliate
  commission is credited by an operator in the admin console. Buyer refunds
  are issued from the Paystack dashboard, then marked Refunded on the order.
- **Outbound email.** Verification codes and reset links are written to the API
  log in development. Notification preferences are saved but nothing is sent.
- **File uploads** (vendor logos, product images). Needs a storage choice — S3 or Cloudinary.
- **AI Document Scan, Camera Capture and Form Submission** tabs on the inventory
  page are still design demos. Manual entry, bulk import and the API are the real
  intake paths.
- **Image search.** The scan icon in the search bar opens a "Coming soon"
  panel. Planned flow: camera photo or upload → Claude vision names the
  product → that text runs through the normal proximity search, shown to the
  user so they can correct it. Needs an `ANTHROPIC_API_KEY`. Matching against
  vendors' own product photos waits on file uploads.
- **Webhooks, OAuth 2.0, sandbox, semantic search, SDKs, 2FA, reviews,
  Google/Apple sign-in.**
- **Cart and delivery fees.** Buy now is one product per payment, and delivery
  fees are agreed with the vendor outside the payment.

## Notes

- Name a migration with `npm run db:migrate --workspace @finder/api -- --name add_x`.
  Generation runs in a `postdb:migrate` hook so the `--name` flag reaches
  `migrate dev`; chaining them in one script sent the flag to the wrong command
  and left `migrate dev` waiting on an invisible prompt.
- Set `NEXT_PUBLIC_API_URL` in `apps/web` to the public API host — the
  developer docs and API-key snippets print it. The browser itself still only
  talks to `/api/proxy`.
- Enum members are defined twice on purpose: `packages/shared/src/enums.ts` for
  the apps and `apps/api/prisma/schema.prisma` for the database. Change both.
- `packages/shared` compiles to CommonJS in `dist/`, because the API compiles to
  CJS and requires it directly. `npm install` builds it via `postinstall`.
- Prisma 7 reads the connection URL from `apps/api/prisma.config.ts`, not from
  `schema.prisma`; the runtime client gets it from the `@prisma/adapter-pg`
  driver adapter in `src/lib/prisma.ts`.
- Every API response uses the envelope `{ ok: true, data }` or
  `{ ok: false, error }`. The fetch wrappers in each app unwrap it.
