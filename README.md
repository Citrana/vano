# Vano

Online shops for small fashion businesses (clothes, shoes, bags, underwear,
accessories). A seller opens a shop, adds products and shares one link
(`/<slug>`). Buyers order on WhatsApp. English and French.

Stack: Next.js 16 (App Router) · TypeScript strict · Tailwind v4 ·
shadcn/ui (base-ui) · Convex (database, storage, Convex Auth) · next-intl.

Read `CLAUDE.md` for the permanent rules before contributing.

## Requirements

- **Node 22 or newer** (Convex refuses older versions). The repo pins 24 in `.nvmrc`.
- **pnpm 10** (the version is pinned in `package.json` → `packageManager`).
- A free **Convex account**: https://dashboard.convex.dev

## Getting started (first time)

### 1. Get the code and the right Node

```bash
git clone https://github.com/Citrana/vano.git
cd vano
git switch develop

nvm install          # reads .nvmrc (Node 24); skip if already installed
nvm use              # run this in every new terminal for this project
corepack enable      # makes the pinned pnpm version available
```

### 2. Install dependencies

```bash
pnpm install         # also installs the Husky git hooks
```

### 3. Connect Convex (terminal 1, keep it running)

```bash
npx convex login     # once per computer: opens the browser to sign in
npx convex dev       # first run: choose your project (or create "vano")
```

`npx convex dev` pushes the schema and functions, writes `.env.local`
(`CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`), then **keeps running** and
redeploys on every change in `convex/`. Wait for
`Convex functions ready!` before going on.

### 4. Set up authentication (terminal 2, once per deployment)

```bash
npx @convex-dev/auth
```

It sets `JWT_PRIVATE_KEY`, `JWKS` and `SITE_URL` on the Convex deployment.
When asked for the site URL, use the address the app runs on:
`http://localhost:3000` (or the port `pnpm dev` prints, see below).

Check they are set (names only):

```bash
npx convex env list
```

### 5. Optional: public site URL

Share links and link previews (OG tags) use `NEXT_PUBLIC_SITE_URL`. In dev
it defaults to the browser address, so you can skip this. To set it, add a
line to `.env.local`:

```bash
echo 'NEXT_PUBLIC_SITE_URL=http://localhost:3000' >> .env.local
```

### 6. Start the app (terminal 2)

```bash
pnpm dev             # http://localhost:3000
```

If port 3000 is taken (e.g. by Docker / Colima), Next uses the next free
port (3001…). Then make `SITE_URL` match it:
`npx convex env set SITE_URL http://localhost:3001`.

Open the app → **Open my shop** → sign up → create your shop → add
products → open your shop link.

### 7. Optional: test payments (development only)

Plans and billing work without real money through a **mock** payment
provider. Turn it on for your dev deployment:

```bash
npx convex env set PAYMENTS_PROVIDER mock
npx convex env set PAYMENTS_MOCK_ENABLED true
```

Then **Plan** in the dashboard → pick a plan → the checkout says "Test
mode" with Simulate success / failure / pending and Cancel. **Never set
these on production.** Without them, checkout is off and sellers see
"Talk to us".

To test an ending trial or plan, set a subscription's `periodEnd` to the
past in the Convex dashboard, then run `npx convex run billingJobs:expireDue`
(it also runs every hour).

How plans, checkout, providers and limits work: [docs/payments.md](docs/payments.md).

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

Billing: shops created before plans existed get a fresh 2-month trial
(shops that already have a plan are left alone):

```bash
npx convex run migrations:billingV1          # "started" (or "already_done")
npx convex run migrations:billingV1Status    # status: "done"
```

Notifications: change-request decisions stored in the old
`sellerNotifications` table move into the new inbox:

```bash
npx convex run migrations:notificationsV1          # "started" (or "already_done")
npx convex run migrations:notificationsV1Status    # status: "done", left: 0
```

Shop looks: the old look picker (`shops.theme`: bold / soft / dark) moves to
the new Shop look store as a published Classic / Blush / Noir look. Shops
that already designed a look keep it:

```bash
npx convex run migrations:looksV1          # "started" (or "already_done")
npx convex run migrations:looksV1Status    # status: "done"
```

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

## Every day

Two terminals, in the project folder:

```bash
# terminal 1
nvm use
npx convex dev

# terminal 2
nvm use
pnpm dev
```

## Before committing

```bash
git switch -c feat/my-change   # <type>/<kebab-case>: feat, fix, refactor, chore, docs, test
pnpm typecheck
pnpm lint
pnpm test                      # also runs automatically in the pre-commit hook
```

Open the PR into `develop`.

## Production

```bash
npx convex deploy                         # push functions to the prod deployment
npx @convex-dev/auth --prod               # auth keys + SITE_URL on prod (once)
npx convex env set SITE_URL https://your-domain --prod
pnpm build && pnpm start                  # or deploy the Next app on Vercel
```

On the hosting side (e.g. Vercel), set `NEXT_PUBLIC_CONVEX_URL` (the prod
deployment URL) and `NEXT_PUBLIC_SITE_URL` (your domain). On Vercel you can
instead set `CONVEX_DEPLOY_KEY` and use the build command
`npx convex deploy --cmd 'pnpm build'`.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Your Node version … is too old. Convex requires at least Node v22` | `nvm use` (or `nvm install`) in that terminal |
| `A local backend is still running on port 3210` | A local/anonymous Convex backend is still running. Stop it (Ctrl+C in its terminal, or `lsof -iTCP:3210 -sTCP:LISTEN` and quit that process), then rerun `npx convex dev` |
| Sign up / login fails with a server error | Auth isn't set up on this deployment: run `npx @convex-dev/auth`, check with `npx convex env list` |
| Login works but you're logged out on refresh / redirect issues | `SITE_URL` doesn't match the address in your browser (port!): `npx convex env set SITE_URL http://localhost:<port>` |
| Blank pages / "Convex URL not set" | `.env.local` is missing `NEXT_PUBLIC_CONVEX_URL`: run `npx convex dev`, then restart `pnpm dev` |
| Commit refused: `Invalid branch name` | Rename the branch: `git branch -m feat/short-description` |

No Convex account? `CONVEX_AGENT_MODE=anonymous npx convex dev` runs a
throwaway local backend instead (then run step 4 against it too).

### Environment

| Where | Variable | Purpose |
|---|---|---|
| `.env.local` | `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL (written by `convex dev`) |
| `.env.local` | `NEXT_PUBLIC_SITE_URL` | Public origin for share links and OG tags, e.g. `https://vano.app` (defaults to the browser origin / `http://localhost:3000`) |
| Convex | `SITE_URL` | Same origin, used by Convex Auth |
| Convex | `JWT_PRIVATE_KEY`, `JWKS` | Convex Auth signing keys (`npx @convex-dev/auth`) |
| Convex | `PAYMENTS_PROVIDER` | Payment provider id (`mock` for now). Unset = online payments off |
| Convex | `PAYMENTS_MOCK_ENABLED` | `true` lets the mock provider run. **Development only — never on prod** |

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
