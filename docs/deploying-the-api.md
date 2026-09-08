# Deploying the API to Railway

`apps/web` goes to Vercel. The API does not: it is a long-running Nest server holding
a MySQL connection pool, which is precisely what a serverless function is bad at.
Every cold start would open another pool, and the database would run out of
connections long before the site ran out of traffic.

`railway.json` at the repo root supplies the build, start, pre-deploy and healthcheck
settings. If your project predates config-as-code, the same values are under
Settings → Deploy.

## Two services

### 1. MySQL

Add it from Railway's catalogue. It exposes `MYSQL_URL` on its own service.

### 2. The API

Point it at this repo and **leave Root Directory at the repo root** — the build spans
the whole workspace, not just `apps/api`.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `${{ MySQL.MYSQL_URL }}` — a reference, so it follows the database rather than pinning a URL that will change |
| `JWT_SECRET` | Generate with `openssl rand -base64 48`. The API refuses to boot on anything under 32 characters |
| `CORS_ORIGINS` | Your Vercel domain, e.g. `https://zhspress.vercel.app` |
| `WEB_BASE_URL` | Same domain — used for the payment redirect back from Flutterwave |
| `FLW_PUBLIC_KEY` | From Flutterwave |
| `FLW_SECRET_KEY` | From Flutterwave |
| `FLW_SECRET_HASH` | Must match the value set in the Flutterwave dashboard's webhook settings |

Reference the database with `${{ MySQL.MYSQL_URL }}` rather than pasting the URL.
Railway rotates credentials when a database is restored or moved, and a pasted value
goes stale silently.

## Migrations

**They run as a pre-deploy step, never on application boot.** Railway runs
`pnpm db:migrate:deploy` before the new version takes traffic. If it fails the deploy
is abandoned and the previous version keeps serving.

That command runs the *compiled* migrator (`node dist/migrate.js`) rather than going
through `tsx`, so it does not depend on dev dependencies surviving a production
install. It prints the migrations folder before connecting, so a failed deploy still
shows which path it used.

Booting the app never migrates. Two instances starting at once would race, and a
half-applied schema behind live traffic is far worse than a failed deploy.

## Seeding

Separate and manual, because it creates the first admin account and prints its
password exactly once. After the first successful deploy, from the Railway service
shell:

```
pnpm db:seed
```

It is idempotent — existing rows are left alone — so it is safe to re-run. It creates:

- an admin account (`admin@zhspress.org` unless `SEED_ADMIN_EMAIL` is set)
- three placeholder shipping zones, which the Director still needs to confirm
- four catalogue entries matching the current fixtures

**Save the printed password immediately.** It is hashed on write and never stored in
plain text, so it cannot be recovered.

## Switching the storefront off fixtures

Once the API is deployed and seeded, in Vercel:

- set `API_BASE_URL` to the Railway API domain
- set `USE_FIXTURES` to `false`
- redeploy

Do these together. With `USE_FIXTURES=false` and no reachable API the build fails
rather than degrading, which is deliberate — a storefront quietly serving invented
products is worse than one that refuses to build.

## Checking it worked

```
curl https://<your-api>.up.railway.app/api/health
curl https://<your-api>.up.railway.app/api/products
```

The first should return `{"status":"ok"}`. The second should return the seeded
catalogue — if it returns an empty list, the seed did not run.
