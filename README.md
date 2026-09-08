# ZHS Press

The zhspress.org rebuild: an independent press publishing books, *Light* magazine, and
stationery, in one unified shop.

Next.js (storefront + admin) · NestJS (API) · Drizzle · MySQL · Flutterwave.

## Layout

```
apps/
  web/        Next.js 15 — storefront and /admin
  api/        NestJS — catalogue, cart, checkout, webhooks, capture
packages/
  db/         Drizzle schema + migrations (single source of truth)
  ui/         Design system: tokens, contrast maths, primitives
  shared/     Zod contracts + money/pricing logic used by both apps
```

## Getting started

```bash
pnpm install
cp .env.example .env      # then fill it in
pnpm db:migrate
pnpm dev
```

## Rules that are not negotiable

These are enforced by tests and CI rather than left to review.

**Money is always integer cents.** No floats, no `DECIMAL`, anywhere in the domain.
Decimals exist only at the display boundary (`formatMoney`) and the admin input
boundary (`parseMoneyToCents`). `pnpm --filter @zhs/shared test` covers this.

**The client never sets a price.** `addToCartSchema` has no price field. Checkout
re-reads live prices from the database and recomputes every total from scratch. A
total submitted by a browser is not merely distrusted, it is not read.

**Only the webhook marks an order paid.** The browser redirect back from Flutterwave
is UX only — its query parameters are attacker-controlled. The webhook handler
verifies the `verif-hash` header with a constant-time compare, independently
re-verifies the transaction with Flutterwave, and asserts the amount *and* currency
match the stored order before anything changes. `payments.tx_ref` carries a UNIQUE
constraint so a redelivered webhook cannot produce a second paid order or a second
inventory decrement.

**No `#ffffff` and no `#000000`.** The palette's warmth comes from an oat ground
(`--paper`) and a slightly green near-black (`--ink`). One stray `#fff` is invisible
in review and quietly un-warms whatever it touches, so `pnpm check:tokens` fails the
build on it. Use the tokens in `packages/ui/src/tokens.css`.

**Accents are backgrounds, and carry a required foreground.** A per-title accent is
validated on save: `validateAccent()` picks whichever of `--ink` / `--paper-raised`
is readable on it and rejects colours in the mid-tone dead band where neither is.
Measured: ink on paper 14.58:1, terracotta under paper 5.75:1, terracotta under ink
only 2.69:1.

## Design-time fixtures

`apps/web/.env.local` currently sets `USE_FIXTURES=true`, so the storefront reads
`apps/web/src/lib/fixtures.ts` instead of the API. That exists so the site could be
built and reviewed before the database was provisioned — **the product copy in it is
placeholder and must be replaced before launch.**

With the flag unset the app talks to the real API and a failure throws. It does *not*
fall back to fixtures: a storefront quietly serving invented products because the API
was unreachable is much worse than an error page.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Runs web and api together |
| `pnpm test` | All package tests |
| `pnpm typecheck` | Typechecks every workspace |
| `pnpm check:tokens` | Fails on raw white/black in app styles |
| `pnpm db:generate` | Generates a migration from schema changes |
| `pnpm db:migrate` | Applies migrations |

Never run `drizzle-kit push` against a real environment. Migrations are a deploy step.

## Deployment

Two hosts, because the two apps want different things.

**`apps/web` -> Vercel.** Set the project's **Root Directory** to `apps/web`;
`vercel.json` there handles the rest, including a `turbo-ignore` step so a commit
touching only the API does not trigger a web rebuild. Deploys come from Vercel's Git
integration — previews on every PR, production on `main` — with GitHub Actions
providing the quality gates. Make the CI checks **required** in branch protection, or
Vercel will happily ship a commit whose tests failed.

Environment variables to set in Vercel:

| Variable | Value |
| --- | --- |
| `API_BASE_URL` | The deployed API origin, e.g. `https://api.zhspress.org` |
| `WEB_BASE_URL` | `https://zhspress.org` |
| `USE_FIXTURES` | `false` in production — see below |

**`apps/api` -> Railway.** It is a long-running Nest server holding a MySQL
connection pool, which is what a serverless function is worst at: every cold start
opens another pool, and the database runs out of connections long before the site
runs out of traffic. `railway.json` at the repo root configures the build, start,
pre-deploy and healthcheck settings.

Two services are needed — a MySQL instance and the API itself — plus a handful of
variables. **Migrations run as a Railway pre-deploy step, never on application
boot**, so a bad migration abandons the deploy instead of leaving a half-applied
schema behind live traffic.

Full walkthrough, including seeding the first admin account: **[docs/deploying-the-api.md](docs/deploying-the-api.md)**.

**Before the first production deploy**, note that `USE_FIXTURES=false` means the
storefront reads from the API, which needs a database with a catalogue in it. Until
that exists, production will error rather than quietly serve invented products — which
is deliberate, but it does mean the database has to come first.

## Open items

Tracked in the project plan; all are blocked on people rather than code.

1. **Flutterwave USD** — confirm the merchant account can collect *and* settle USD,
   and which API version it is provisioned for. Blocks checkout work.
2. **light4ph.org TLS certificate has expired** — the magazine redirect cannot be set
   up until it is renewed or DNS is repointed here.
3. **Release dates** — the brief targets Q2/Q3 2025, which has passed.
4. **Illustration** — who supplies the art, and under what licence. The palette and
   type give a warm shell; the character comes from illustration.
