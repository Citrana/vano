# Vano

Online shops for small fashion businesses (clothes, shoes, bags, underwear,
accessories). A seller opens a shop, adds products and shares one link
(`/<slug>`). Buyers order on WhatsApp. English and French.

Stack: Next.js 16 (App Router) · TypeScript strict · Tailwind v4 ·
shadcn/ui (base-ui) · Convex (database, storage, Convex Auth) · next-intl.

Read `CLAUDE.md` for the permanent rules before contributing.

## Requirements

- Node 22+ (`nvm use` reads `.nvmrc`), pnpm 10

## Getting started

```bash
pnpm install          # also installs the Husky hooks
npx convex dev        # first run: log in / create a project, writes .env.local
npx @convex-dev/auth  # sets JWT_PRIVATE_KEY, JWKS and SITE_URL on the deployment
pnpm dev              # http://localhost:3000
```

No Convex account yet? `CONVEX_AGENT_MODE=anonymous npx convex dev` runs a
local backend instead.

### Environment

| Where | Variable | Purpose |
|---|---|---|
| `.env.local` | `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL (written by `convex dev`) |
| `.env.local` | `NEXT_PUBLIC_SITE_URL` | Public origin for share links and OG tags, e.g. `https://vano.app` (defaults to the browser origin / `http://localhost:3000`) |
| Convex | `SITE_URL` | Same origin, used by Convex Auth |
| Convex | `JWT_PRIVATE_KEY`, `JWKS` | Convex Auth signing keys (`npx @convex-dev/auth`) |

## Migrating existing data (once per deployment)

A deployment that has users or shops from before roles and permissions needs
a one-time migration. It makes existing users active sellers (an existing
role or status is never changed), marks existing shops active and products
visible, and fills the platform counters used by the admin dashboard.

```bash
npx convex run migrations:rbacV1          # "started" (or "already_done")
npx convex run migrations:rbacV1Status    # status: "done" + totals
```

Add `--prod` after `run` for production. It runs in the background in
batches; running it again is harmless. A brand-new deployment doesn't need
it.

## First super admin

Super admins can't sign up: the first one is created from the terminal.
Run this in the project folder while `npx convex dev` is running (so the
functions are pushed):

```bash
npx convex run seed:superAdmin '{"email":"you@example.com","password":"a-strong-password"}'
```

- **Production:** `npx convex run --prod seed:superAdmin '{"email":"...","password":"..."}'`
- **Another super admin** (once one exists, the command refuses unless you
  pass `force`):
  `npx convex run seed:superAdmin '{"email":"...","password":"...","force":true}'`

It sets up the built-in roles (Super admin, Seller) if they don't exist yet
and prints one of:

| Result | Meaning |
|---|---|
| `created` | New account created as an active super admin. Log in at `/login`. |
| `promoted` | The email already had an account; it is now a super admin. **Its password is unchanged.** |
| `already_super_admin` | Nothing changed. Safe to run again. |

The command can only be run from the terminal or the Convex dashboard, never
from the app. If the only super admin is suspended, running it again
(for them, or for a new email) works without `force`. Each run is recorded in
the admin activity history as "system".

Tip: the password lands in your shell history. Start the command with a
space (zsh/bash skip it when `HIST_IGNORE_SPACE` / `HISTCONTROL=ignorespace`
is set) or clear the history afterwards.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Next dev server |
| `pnpm build` | Production build |
| `pnpm test` | Vitest: Convex functions (convex-test) + client helpers |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc` for the app and for `convex/` |

## Workflow

- Branches: `<type>/<kebab-case>` with type `feat | fix | refactor | chore | docs | test`
  (enforced by `.husky/pre-commit`, which also runs `pnpm test`).
- Every Convex function ships with tests, including ownership checks.
- PRs use `.github/PULL_REQUEST_TEMPLATE.md`.

## Layout

```
convex/            schema, auth, shops, products, files, public, stats (+ tests)
convex/lib/        seller wrappers, shared rules (slug, phone, money, catalog, images)
messages/          en.json, fr.json (always edited together)
src/app/           routes: /, /login, /signup, /onboarding, /dashboard/**, /[slug], /[slug]/[productId]
src/features/      auth, shop, product, public, stats, i18n
src/components/    ui primitives, shell, loading/empty/error states
```
