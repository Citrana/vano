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
