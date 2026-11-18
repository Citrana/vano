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
  (`convex/lib/seller.ts`) and **declare a `permission`** (`ownShop.manage`,
  `ownProducts.manage`, `ownStats.view`, or a list meaning "any of").
  They reject signed-out, suspended and unpermitted callers and add
  `ctx.user` / `ctx.access`. A suspended shop is read-only: every
  `sellerMutation` throws `SHOP_SUSPENDED`. Load the caller's shop with `requireOwnShop(ctx)` and a
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

## Roles & permissions

- Every user has one role; a role is a set of permissions. Permissions
  are defined **only** in `convex/lib/permissions.ts` (`"<area>.<action>"`,
  grouped in `PERMISSION_GROUPS`). Never check a role by name — check a
  permission.
- Built-in roles (`roles.key`): `super_admin` has every permission,
  including future ones (never stored); `seller` has the fixed
  `SELLER_PERMISSIONS`. Neither can be renamed, edited or deleted.
- Public sign-up always creates an active seller. Super admins are created
  only by `seed:superAdmin` (internal action, run from the terminal).
- Admins can close public sign-up (`platformSettings`). It's enforced in
  `setUpNewAccount` (the account is never created); the seed command gets
  a one-time `signupBypasses` row created by internal code only.
- Every authenticated function goes through `loadAccess`
  (`convex/lib/access.ts`): signed-out → `NOT_AUTHENTICATED`, suspended →
  `ACCOUNT_SUSPENDED`. Admin functions use `adminQuery` / `adminMutation`
  with a `permission`; missing it → `FORBIDDEN`. Hiding UI is never enough.
- Admin writes run the safety rules in `convex/lib/guards.ts` (no
  self-change, last super admin protected, no escalation, built-in roles
  locked) and call `logAdminAction` in the same mutation.

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
- **UI design assets** (illustrations, brand marks, sample photos, custom
  icons) live in `src/assets/images/` (see its README for folders,
  formats and credits) and are statically imported into `next/image`.
  `public/` is only for files that need a fixed URL.

## Public pages

- `/[slug]` and `/[slug]/[productId]` are server-rendered with `fetchQuery`
  (`src/features/public/data.ts`, wrapped in React `cache`) for SEO and
  OG tags. Existence is checked in the segment **layouts** so unknown
  shops/products return a real HTTP 404 — a `notFound()` thrown under a
  `loading.tsx` can only stream a 200. Keep `loading.tsx` files inside the
  `(shop)` group / product segment so they never wrap a child's check.

## Marketing site

- Pages live in the `src/app/(marketing)/` group (Home, Features, Pricing,
  Demo, Help, Terms, Privacy). The group layout adds the announcement
  banner, `MarketingNav` and `MarketingFooter`; code is organised by page in
  `src/features/marketing/{shared,home,features,pricing,demo,help}`.
- Plan ids, prices, limits and the trial live **only** in
  `convex/lib/plans.ts`; marketing cards and the comparison table in
  `src/features/marketing/pricing/plans.ts` import them (labels in
  `Pricing.*` messages).
- Contact values come from `shared/site-config.ts`
  (`NEXT_PUBLIC_CONTACT_WHATSAPP`, `NEXT_PUBLIC_CONTACT_EMAIL`).
- Sign-up buttons always use `OpenShopCta` (sign-up closed note, signed-in
  → dashboard). Coral stays the one main action per screen.
- The demo shop (`/demo`) is static data in `demo/demo-shop.ts` rendered
  with the public shop components: no Convex, no stats.
- Shop looks (`bold | soft | dark`) are token overrides under
  `[data-shop-theme]` in `globals.css`, listed in
  `src/features/shop-themes/themes.ts`.
- Server components must not import values from `"use client"` modules
  (they arrive as client references); shared constants go in plain `.ts`.

## Billing

- **`docs/payments.md` is the reference for payments and billing.** Any
  change to how payments, plans, trials, limits, providers, checkout, the
  expiry / reconcile jobs or billing admin work must update that doc **in
  the same commit**: add a dated entry (`YYYY-MM-DD HH:MM` with timezone,
  e.g. `2026-11-18 19:29 CAT (UTC+02:00)`) at the top of its change log
  and refresh its "Last updated" line. Never ship a payment change without it.
- One `subscriptions` row per shop (`trialing | active | expired | free`),
  written only through `convex/lib/subscriptions.ts` (`writeSubscription`,
  which also logs the change). New shops start a `TRIAL_MONTHS` Pro trial
  in `shops.create`. Nothing renews automatically; the hourly cron
  `billingJobs.expireDue` moves ended periods to Free.
- **Every plan limit goes through `convex/lib/entitlements.ts`**:
  `requireCan(ctx, shop, action)` in mutations, `hasFeature` in queries,
  the pure `canShopDo` in the UI. Never compare a plan name or hard-code a
  limit. A new paid feature = a `PlanFeatureFlag` in `plans.ts` + a
  `requireCan({ kind: "feature" })` call.
- Downgrades never delete or change data: public visibility is computed
  (`visibleProductIds`: pinned first, then newest, up to the limit).
  Over-limit products stay editable; photos are capped publicly.
- Payments go through the `PaymentProvider` interface
  (`convex/payments/provider.ts`), registered in `payments/registry.ts`
  and chosen by the `PAYMENTS_PROVIDER` env var. Amounts come from
  `PLAN_PRICE_MINOR`, never the client. Provider results (webhook
  `POST /payments/callback/<provider>`, status polls, the mock) are applied
  **only** by `applyEvent` in `payments/core.ts`, which dedupes event ids,
  never changes a final payment and extends a plan once (`appliedAt`).
- The mock provider runs only with `PAYMENTS_PROVIDER=mock` **and**
  `PAYMENTS_MOCK_ENABLED=true` on the deployment. Never set them on prod.
- Admins grant / extend plans with `billing.manage`, a reason, never on
  their own shop (`assertNotOwnShop`).

## Stats

- Views and WhatsApp clicks are counted in daily rows (`shopDailyStats`,
  `productDailyStats`, UTC day) — never as counters on the shop/product
  documents. No personal data (no IP, no user agent) is ever stored.
- The client sends each view once per browser session (`trackOnce`).
- Platform-wide totals (admin dashboard) live in `@convex-dev/aggregate`
  components. **Every insert or delete** of a user, shop, product or
  `shopDailyStats` row calls the matching helper in
  `convex/lib/platformStats.ts` (`onShopCreated`, `onProductDeleted`, …)
  in the same mutation, or the counters drift. Tests use `newTest()` from
  `convex/lib/test.utils.ts`, which registers the components.

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

- **Brand tokens** live only in `src/app/globals.css` (`--coral`,
  `--coral-strong`, `--ink`, `--cream`, `--blush`, `--plum`, shadows) and
  map to the shadcn semantic tokens. Never hard-code a hex color in a
  component. Font: Plus Jakarta Sans, bold headings.
- **Coral is for the main action only**: one default (`bg-primary`)
  button per screen, plus one `<hl>` highlighted word per landing
  headline. Selected chips / toggles use `chip-selected` (ink), badges
  plum. Button fills use `--coral-strong` and WhatsApp `--whatsapp` so
  white text passes WCAG AA; plain `--coral` text only at >= 24px.
- **Surfaces**: one radius scale (`rounded-sm` 6px tags/badges,
  `rounded-md` 10px buttons/inputs, `rounded-lg` 12px tiles, `rounded-xl`
  16px cards; `rounded-full` only for chips, avatars, dots, switches, the
  language switch). Surfaces use a 1px `border` (`--border`), never a
  shadow; `shadow-float` is the only shadow, for floating things (sheet,
  dialog, hero cards). Focus uses `focus-ring` (2px, keyboard only).
- **Mobile-first**: design for ~360px first, tap targets ≥ 44px, no
  horizontal page scroll.
- Every page has loading, empty and error states (`src/components/states`).
- Forms: react-hook-form + Zod. Required fields use `<Label required>`;
  forms with several fields show `<RequiredFieldsHint />`.
- Components are small and grouped by feature in `src/features/<feature>/`
  (`auth`, `shop`, `product`, `public`, `stats`, `i18n`, `marketing/*`,
  `shop-themes`, `billing`, `admin/*`).
  Generic primitives live in `src/components/ui/`.
- Admin pages live under `src/app/admin/` and wrap their content in
  `<RequirePermission permission="…">`. Sidebar sections are defined only
  in `src/features/admin/shell/nav.ts` (flip `ready` when a page ships).
  Hiding a link or button is never security — the Convex function checks.
- Pure modules imported by Vitest use relative imports (Vitest has no `@/`
  alias).

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
  billing.ts billingJobs.ts crons.ts   # seller billing, expiry job
  payments/         # provider interface, mock, result handling
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
