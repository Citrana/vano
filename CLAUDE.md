@AGENTS.md

# Vano — online shops for small fashion businesses

Sellers (clothes, shoes, bags, underwear, accessories) open a shop with a
shareable link (`/<slug>`); buyers order on WhatsApp. Stack: Next.js 16
(App Router), TypeScript (strict), Tailwind v4, shadcn/ui (base-ui),
Convex (database, file storage, Convex Auth email + password), next-intl.

This file records **permanent rules**. They apply to every feature, now and
later — do not relax them for convenience. The MVP has **no AI and no 3D**.

## Security & ownership

- Every Convex function declares `args` validators. Never trust the client.
- Seller functions are built with `sellerQuery` / `sellerMutation`
  (`convex/lib/seller.ts`): they reject unauthenticated callers and add
  `ctx.user`. Load the caller's shop with `requireOwnShop(ctx)` and a
  product with `requireOwnProduct(ctx, id)` — a seller can only read or
  change **their own** shop and products. A product that isn't yours is
  reported as `NOT_FOUND`, never as "forbidden" (don't leak existence).
- **One shop per user** (`shops.by_ownerId`), enforced in `shops.create`.
- Public functions (`convex/public.ts`, the `stats.record*` mutations) never
  return `ownerId` or any personal data, and never accept one.
- Errors thrown to the UI are `ConvexError` with a code from
  `convex/lib/errors.ts`; the UI maps codes to translated messages
  (`Errors.<code>`). Never show raw server messages.
- Route protection for seller pages is client-side (`AuthGate`), like the
  reference project (Convex Auth + `proxy.ts` upstream bug
  get-convex/convex-auth#271). The real boundary is always server-side.

## Money

- Prices are **integers in minor units** (×100 for every currency) plus the
  shop's `currency` (`USD | CDF | KES | EUR`). Never store floats.
- Use `convex/lib/money.ts` (`currencyValidator`, `parseMoneyToMinor`,
  `minorToInput`, `formatMoney`) and `<MoneyInput>` — never parse or format
  money by hand.

## Shared validation

- Rules shared by client and server live as pure helpers in `convex/lib/`
  (`slug.ts`, `phone.ts`, `catalog.ts`, `money.ts`, `images.ts`). Client
  Zod schemas (`src/features/*/schemas.ts`) call them, server mutations
  call them again. Never duplicate a rule.
- Slugs: lowercase `a-z 0-9 -`, 3–30 chars, unique, not in
  `RESERVED_SLUGS`. Every top-level route folder in `src/app/` must be in
  `RESERVED_SLUGS` (a test checks it).
- WhatsApp numbers are stored E.164 (`+243…`), validated with
  `libphonenumber-js`.

## Images

- Images are compressed in the browser before upload
  (`src/lib/compress-image.ts`: max 1200px, ~300 KB) and uploaded to Convex
  storage via `files.generateUploadUrl`.
- The server re-checks every storage id (`imageProblem`: `image/*`,
  ≤ `MAX_IMAGE_BYTES`). A replaced or removed file — or a deleted product's
  files — is deleted from storage in the same mutation.
- Files are owned: attach them only through `claimImages` and delete them
  only through `deleteFilesNotIn` (`convex/lib/seller.ts`). The `uploads`
  table records who first attached each storage id, so a seller can never
  attach — and later delete — another seller's image.

## Public pages

- `/[slug]` and `/[slug]/[productId]` are server-rendered with `fetchQuery`
  (`src/features/public/data.ts`, wrapped in React `cache`) for SEO and
  OG tags. Existence is checked in the segment **layouts** so unknown
  shops/products return a real HTTP 404 — a `notFound()` thrown under a
  `loading.tsx` can only stream a 200. Keep `loading.tsx` files inside the
  `(shop)` group / product segment so they never wrap a child's check.

## Stats

- Views and WhatsApp clicks are counted in daily rows (`shopDailyStats`,
  `productDailyStats`, UTC day) — never as counters on the shop/product
  documents. No personal data (no IP, no user agent) is ever stored.
- The client sends each view once per browser session (`trackOnce`).

## Internationalization

- English and French, always. Every string ships in `messages/en.json` and
  `messages/fr.json` together, scoped by namespace. No hardcoded UI text.
- No locale in URLs. Seller pages use the `NEXT_LOCALE` cookie (set by
  `LanguageSwitcher`), falling back to `Accept-Language`, then `en`
  (`src/i18n/request.ts`).
- Public shop pages always render in **the shop's language**
  (`shops.language`), whatever the visitor's settings — including the
  WhatsApp order message.

## UI

- **Mobile-first**: design for ~360px first, tap targets ≥ 44px, no
  horizontal page scroll.
- Every page has loading, empty and error states (`src/components/states`).
- Forms: react-hook-form + Zod. Required fields use `<Label required>`;
  forms with several fields show `<RequiredFieldsHint />`.
- Components are small and grouped by feature in `src/features/<feature>/`
  (`auth`, `shop`, `product`, `public`, `stats`, `i18n`). Generic
  primitives live in `src/components/ui/`.

## Workflow

- Every Convex function ships with tests (Vitest + convex-test) covering its
  main behaviour, its ownership checks and edge cases. Non-negotiable.
- **Branch naming**: `<type>/<kebab-case-description>` (`feat`, `fix`,
  `refactor`, `chore`, `docs`, `test`); `main` / `develop` excepted.
  Enforced by Husky `pre-commit`, which also runs `pnpm test`.
- Small, focused commits. PRs use `.github/PULL_REQUEST_TEMPLATE.md`.
- Test helpers are named `*.test.utils.ts` / `test.utils.ts` style with
  two dots so the Convex CLI never pushes them.

## Project layout

```
convex/
  schema.ts         # all tables
  auth.ts auth.config.ts http.ts   # Convex Auth (Password, sign-up enabled)
  users.ts shops.ts products.ts files.ts public.ts stats.ts
  lib/              # seller wrappers, shared rules, test setup
  *.test.ts
messages/en.json fr.json
src/
  app/              # routes (no locale segment); [slug] = public shop
  components/ui/    # primitives;  components/states/  # loading/empty/error
  features/         # auth, shop, product, public, stats, i18n
  i18n/request.ts   # cookie / Accept-Language locale
  lib/              # client utilities
```

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
