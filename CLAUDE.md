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
- The landing phone, the Features previews and the demo shop use the
  seller presets (`src/features/shop-looks/presets.ts`), so what visitors
  see is what sellers get (see "Shop looks").
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

## Shop looks

- A look is **a preset plus optional per-facet overrides**
  (`StoredLook` in `convex/lib/looks/validators.ts`: `colors`, `buttons`,
  `banner`, `promo`). A missing facet means "the preset's". Later phases (fonts,
  backgrounds, patterns, card styles, section order) add an optional facet,
  a default on every preset, a branch in `resolveLook` and an editor
  section; never rewrite stored looks.
- The "Shop look" page is a sectioned editor: sections are registered
  **only** in `LOOK_SECTIONS` (`src/features/shop-looks/editor/sections.tsx`:
  key, icon, panel, `changed`, `locked`, optional `resets` /
  `previewBanner`) with labels in `LookEditor.sections.<key>` / `<key>Hint`.
  Tabs, `?section=` address, unsaved dots, Pro locks, the phone bottom
  sheet and the preview all read it; never add a section by hand.
- Presets, curated swatches, gradients and artworks live **only** in
  `convex/lib/looks/` (`presets.ts`, `banners.ts`); names in
  `ShopLooks.*` / `LookEditor.*`. `classic` is the free look. Every preset
  must pass the contrast check with zero warnings (tested).
- `resolveLook` (pure) turns a look into the semantic tokens; text colours
  are derived, never picked. `ShopLookScope` applies them inline (no
  flash); shop buttons use `shop-btn`, chips `shop-chip` (rules in
  `globals.css`). The WhatsApp order button keeps `--whatsapp`.
- One row per shop in `shopLooks` (`draft`, `published`), written only by
  `convex/shopLooks.ts` (seller: `saveDraft`, `publish`, `discardDraft`)
  and `admin/shopLooks.reset`. Values are re-checked with `cleanLook`;
  banner photos go through `claimImages` / `deleteFilesNotIn`.
- `publish` refuses a blocking contrast problem (`lookProblems`,
  `LOOK_CONTRAST`) and needs the `allLooks` plan feature for anything but
  the free look. Drafts save on every plan. Public pages show the
  published look only while the plan allows it (`visibleLook`), else the
  free look; the design is never deleted.
- Public queries return a resolved `PublicLook` (banner photo as a URL),
  never the draft or a storage id.
- Admins with `shops.resetLook` reset the banner (photo + text) or the
  whole look, with a reason, never on their own shop; it's logged
  (`shop.lookReset`) and the seller is notified (`look.reset`).

- Button designs (`convex/lib/looks/buttonDesigns.ts`: design, decoration
  icon, order label) are optional fields of the `buttons` facet, gated by
  `allLooks` like any override. They're drawn **only in CSS** (`globals.css`,
  `data-btn-design` / `data-btn-deco`) on `shop-action` buttons and
  `shop-chip` chips; decorations are corner pseudo-elements reusing the
  sticker SVGs, animations only under `prefers-reduced-motion:
  no-preference`. The WhatsApp button keeps `--whatsapp` and its icon; its
  label comes from `Public.orderLabels`. The Sticker offset shadow is a
  seller-chosen shop style, the one exception to "no shadows" (shop pages only).

### Event & promo banners

- An optional `promo` facet (`PromoFacet`: template design + height +
  optional `startsAt` / `endsAt`) shows **instead of** the normal banner
  while live; the normal `banner` is never replaced. One promo per look.
- Templates are data + code, never image files: ids, palettes, fonts and
  text limits in `convex/lib/looks/events.ts`; how each is drawn
  (decor shapes, sticker slots) in
  `src/features/shop-looks/events/templates/`; names and default texts in
  `EventBanners.*`. Adding one = an entry, a layers file, EN/FR texts.
  Palettes are curated only; every template × palette passes 4.5:1
  (tested). Decor and stickers stay in their zones, never over the text
  (`u + size / 2 <= 0.95`, tested). Default texts use the shop's language.
- Stickers live in `src/assets/images/stickers/` (`manifest.ts` is the
  one list, also used by the server to check ids; see its README). Never
  rename or remove a sticker id in use. Original generic motifs only.
- `EventBanner` draws the shop banner, previews, the admin card and the
  downloads (`modern-screenshot`, browser-side) from the same code.
- Queries never read the clock: `shopLooks.promoLive` is stored by
  `publish` and `shopLookJobs.syncPromo` (scheduled at start / end,
  idempotent); `endPromoNow` ends it at once. Rules (`scheduleProblem`,
  `PROMO_MAX_DAYS`) in `convex/lib/looks/schedule.ts`.
- Publishing a promo needs `salesPromotions`; public pages show it only
  while live and entitled (`visibleLook`). Admin "banner" reset removes it.

## Protected shop changes

- After creation, a shop's **name, link (slug) and WhatsApp number** only
  change through a request an admin approves (anti-impersonation).
  `shops.update` never accepts them; `applyShopChange`
  (`convex/lib/shopChanges.ts`) is their only writer, called by
  `admin/changeRequests.approve`. Currency is locked once a shop has
  products (`CURRENCY_LOCKED`).
- Every limit lives in `convex/lib/changeRequests.ts`
  (`CHANGE_COOLDOWN_DAYS`, `SLUG_REDIRECT_DAYS`, reason lengths, code
  TTL/attempts). One pending request per field. A request inside the
  cooldown is accepted but flagged; approving it needs
  `overrideCooldown` (logged). Brand names in `convex/lib/protectedNames.ts`
  are **flagged** for the admin, never silently accepted or refused;
  reserved route words are refused by `slugProblem`.
- Link availability is one rule: `slugHolder` / `slugAvailableFor`
  (a shop's slug, or another shop's live `slugRedirects` row). Old links
  redirect (307) to the shop's current link for 90 days and stay reserved
  meanwhile; `changeRequestJobs.cleanup` (daily cron) frees them. The
  redirect lookups live in the `[slug]`, `(shop)` and `[productId]` layouts.
- A new WhatsApp number needs a verified code (`changeRequests.sendPhoneCode`
  / `verifyPhoneCode`): only a salted hash is stored, sends are rate
  limited (`convex/lib/rateLimits.ts`, `@convex-dev/rate-limiter`), wrong
  codes are counted (the mutation returns the problem instead of throwing,
  or the count would roll back). Senders implement `CodeSender`
  (`convex/verification/`), chosen by `VERIFICATION_SENDER` (`log` for
  now). **Test mode** (`VERIFICATION_SENDER=log` + `VERIFICATION_TEST_MODE=true`)
  shows the code on screen: never set it on prod.
- New requests notify `changeRequests.view` admins (one notification:
  flagged or plain); decisions notify the seller with the reason (see
  "Notifications"). Admin access: `changeRequests.view` / `.decide`,
  never on your own shop. Every request, cancel, decision and applied
  change is logged (`logAdminAction`, phone numbers masked).

## Notifications

- In-app notifications are separate from toasts: **toasts are only for
  instant feedback** on the user's own action; anything someone should see
  later (or act on) is a notification, a live count or both.
- **One service**: features call `notify(ctx, { data, to, dedupeKey })`
  (`convex/lib/notify.ts`) in the same mutation as the change. It's the
  only writer of the `notifications` table (one row per recipient).
  Never insert notification rows by hand, never pick channels in a feature.
- Types live **only** in `convex/notifications/types.ts`: a `data`
  validator per type (discriminated union, ids + the short values the text
  needs, WhatsApp numbers masked), its category and audience, and
  `notificationHref` (links are computed, never stored). A new type also
  needs both translations (`Notifications.types.*`) and an icon
  (`notification-item.tsx`). Text is built on the client, so it's always
  in the **viewer's** language.
- Recipients: one user (`{ userId }`) or everyone holding a permission
  (`{ permission }`, resolved through roles; super admins included,
  suspended users skipped). The permission is stored on the row and
  **checked again on every read**, so losing it hides old notifications
  too. Exclude the shop's owner from admin notifications about their shop.
- Every notification has a `dedupeKey` (e.g. `pay.failed:<paymentId>`);
  the same key never reaches a user twice, so retries are safe.
- The inbox (`convex/notifications/inbox.ts`, `accountQuery` /
  `accountMutation`) only reads or changes the caller's own rows. Someone
  else's id is `NOT_FOUND`. Marking read works for a suspended shop.
- **Counts never come from notifications**: sidebar badges and the admin
  "Needs attention" cards use `admin/attention.counts`, which reads the
  real tables (pending requests, unresolved failed payments, plans ending
  soon) and returns null for numbers the viewer may not see. Badge items
  are set with `attention` in `nav.ts`; cards link to their list with the
  filters in the URL (read by the list's `table-spec.ts`).
- Limits and retention live only in `convex/notifications/config.ts`
  (`NOTIFICATION_RETENTION_DAYS`, `COUNT_CAP`, …). The daily cron
  `notificationJobs.cleanup` deletes old rows; `notificationJobs.endingSoon`
  sends the ending-soon warnings.
- Outside delivery (WhatsApp, email) implements `NotificationChannel`
  (`convex/notifications/channel.ts`), registered in `registry.ts` and
  enabled by `NOTIFY_CHANNELS`; `notify` schedules it. Features don't change.

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
- The dashboard's "Get your shop ready" checklist is computed by
  `convex/lib/onboarding.ts` from real data (products, a published look,
  `shops.onboarding.linkSharedAt`). `shops.update` patches only the
  settings it accepts, so other fields (protected ones, status,
  onboarding) are never touched by it.
- Forms: react-hook-form + Zod. Required fields use `<Label required>`;
  forms with several fields show `<RequiredFieldsHint />`.
- Components are small and grouped by feature in `src/features/<feature>/`
  (`auth`, `shop`, `product`, `public`, `stats`, `i18n`, `marketing/*`,
  `shop-looks`, `billing`, `change-requests`, `notifications`, `admin/*`).
  Generic primitives live in `src/components/ui/`.
- Admin pages live under `src/app/admin/` and wrap their content in
  `<RequirePermission permission="…">`. Sidebar sections are defined only
  in `src/features/admin/shell/nav.ts` (flip `ready` when a page ships).
  Hiding a link or button is never security — the Convex function checks.
- **Admin lists** use the shared `DataTable` (`src/features/admin/data-table/`);
  a page only defines its columns, its pure URL spec (`table-spec.ts`:
  filter keys, options, defaults) and labels (`filterDefs`). Never build a
  list, filter bar, pagination or date input by hand. Filters, search,
  page, page size, sort and the open row live in the URL (`useTableState`,
  pure codec in `url-state.ts`); a record opens in `DetailsDrawer`
  (`?open=<id>`, links built only by `adminHref`); old
  `/admin/<list>/<id>` routes redirect there. Only the date column sorts,
  on the server (`order` arg, `convex/lib/listOrder.ts`). Statuses use
  `StatusTag` (one tone map in `status-tones.ts`).
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
  shopLooks.ts      # shop look draft / publish (lib/looks/: model, presets, contrast)
  changeRequests.ts changeRequestJobs.ts   # protected shop changes
  notifications/    # notification types, inbox, config, outside channels
  notificationJobs.ts                     # ending-soon warnings, cleanup
  verification/     # swappable code senders
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
