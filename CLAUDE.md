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
  They reject signed-out, suspended and unpermitted callers, resolve the
  caller's **current shop** (own shop or a team membership, see "Team
  accounts") and add `ctx.user`, `ctx.access` (shop-scoped permissions)
  and `ctx.shopAccess`. A suspended shop is read-only: every
  `sellerMutation` throws `SHOP_SUSPENDED`. Load the caller's shop with `requireOwnShop(ctx)` and a
  product with `requireOwnProduct(ctx, id)` — a seller can only read or
  change **their current** shop and its products. A product that isn't yours is
  reported as `NOT_FOUND`, never as "forbidden" (don't leak existence).
- **One shop owned per user** (`shops.by_ownerId`), enforced in
  `shops.create` (an `accountMutation` checking the global role); being a
  team member elsewhere never prevents it.
- Public functions (`convex/public.ts`, incl. the discount code mutations, the `stats.record*` mutations) never
  return `ownerId` or any personal data, and never accept one.
- Errors thrown to the UI are `ConvexError` with a code from
  `convex/lib/errors.ts`; the UI maps codes to translated messages
  (`Errors.<code>`). Never show raw server messages.
- Route protection for seller pages is client-side (`AuthGate`), like the
  reference project (Convex Auth + `proxy.ts` upstream bug
  get-convex/convex-auth#271). The real boundary is always server-side.
- **Security headers** are defined only in `src/lib/security-headers.ts`:
  the static ones (nosniff, Referrer-Policy, Permissions-Policy,
  X-Frame-Options, HSTS in production) applied by `next.config.ts`
  (`poweredByHeader: false`), the Content-Security-Policy by `src/proxy.ts`
  with a fresh nonce per request (headers only, no auth there). Convex
  origins come from env (`NEXT_PUBLIC_CONVEX_URL`, optional
  `CONVEX_STORAGE_ORIGIN`). A new external origin the browser loads
  (script, image, fetch / websocket) is added there; scripts never get
  `'unsafe-inline'`, and `style-src` never gets a nonce. Zod runs
  `jitless` on the client (`src/lib/zod-config.ts`, imported first by
  `ConvexClientProvider`) so it never probes eval.

## Auth codes

- Email verification and password reset use Convex Auth's own
  `Password({ verify, reset })` flows, never a parallel system: a 6-digit
  code by email (`authCodeProvider` in `convex/emails/authCode.ts`,
  `newCode`), stored hashed, expired and used up by Convex Auth.
  Rules live **only** in `convex/lib/authCodes.ts` (15-minute codes, 5
  wrong tries an hour per email — Convex Auth's sign-in bucket, shared
  with wrong passwords —, 60 s resend wait, 15-minute lock wait).
- Sign-up gives **no session** until the code is entered (same screen,
  `VerifyEmailStep`); an unverified account signing in gets a new code.
  Resend = sign in again with the password. Reset is email → code → new
  password: the code is checked first by `authCodes.checkResetCode`
  (read-only, result returned not thrown, per-email `resetCodeCheck`
  bucket, unknown email = `invalid`); `reset-verification` then checks it
  again, uses it up, changes the password, verifies the email and signs
  out other sessions.
- `guardPasswordFlows` (`convex/lib/authFlows.ts`) wraps the provider's
  `authorize`: a `reset` never reveals whether an account exists (same
  answer, send limit taken for every address, `RESET_MIN_RESPONSE_MS`),
  and `email-verification` must carry a code. Don't bypass it.
- Code emails are sent while the person waits (`sendEmailNow`), in the
  account's language (`users.language` from sign-up, else its shop's,
  else English), limited by `authCodeBurst` / `authCodeHourly`; a failed
  send is `EMAIL_SEND_FAILED` and the screen offers a retry.
- Accounts from before codes count as verified (`migrations:emailVerifiedV1
  { before }`); `seed:superAdmin` marks its account verified. Expired codes
  are deleted hourly (`authCodeJobs.cleanup`).
- The code input (`code-input.tsx`, pure rules in `code-input-logic.ts`):
  numeric keyboard, `one-time-code`, auto-advance, paste fills all.
  Screens share `useCodeStep` (resend wait, wrong-try lock, errors).

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
  locked) and call `logAdminAction` in the same mutation. "Never on their
  own shop" (`assertNotOwnShop`) covers shops they own **or** belong to.
- Seller permissions are fine-grained per area (`ownShop.view/manage`,
  `ownProducts.view/manage`, `ownOffers`, `ownLook`, `ownSales`,
  `ownCustomers`, `ownStats`, `ownReports`, `ownBilling`, `ownTeam`,
  `ownActivity`); the global `seller` role holds them all, a team role a
  subset (see "Team accounts").

## Team accounts

- Business shops (`teamRoles` plan feature) add people with a **preset
  role**, defined **only** in `convex/lib/team.ts` (`TEAM_ROLES`): Manager
  (everything but plan, billing, team), Seller (record sales, customers,
  view products), Editor (products, offers, shop look), Viewer (stats and
  reports). The owner is never a `shopMembers` row and always holds every
  seller permission; `ownBilling.manage` and `ownTeam.manage` are owner
  only (`OWNER_ONLY`, tested). Never check a role by name: check a
  permission.
- **Current shop + shop-scoped permissions** (`convex/lib/shopAccess.ts`):
  `currentShopAccess` picks `users.activeShopId` while usable, else the
  owned shop, else the oldest usable membership. Effective permissions =
  global admin permissions + global seller permissions ∩ the shop role
  (`effectivePermissions`). `sellerQuery` / `sellerMutation` check the
  declared permission against them; `users.viewer.permissions` returns the
  same set, so every UI check follows the role. Another shop's data stays
  `NOT_FOUND`.
- Seats: `requireCan({ kind: "addMember", seats })` (members + pending
  invites vs `teamMembers`, owner not counted) on invite, renew and
  accept. **Paused** is computed, never stored (`usableMemberIds` in
  `entitlements.ts`: none without `teamRoles`, else first joined up to the
  limit), so downgrades pause and upgrades restore with nothing deleted.
  Suspended (by the owner) is stored on the row; removing deletes the row,
  effective on the member's next call. Paused / suspended members get the
  "paused" screen (`MemberPaused`, gate target `memberPaused`).
- Invites (`convex/team.ts`, owner only): a one-time link `/join/<token>`
  (32 random bytes; only its SHA-256 is stored; shown once — "New link"
  rotates it), `INVITE_TTL_DAYS` (7), anyone holding it may accept.
  Optional email through `sendEmail` (`emails/teamInvite.ts`, template
  `teamInvite`, owner-picked language), limited by `teamInvite`. A valid
  invite lets its person sign up while public sign-up is closed (`invite`
  sign-up param → `users.pendingInvite`, read and cleared in
  `setUpNewAccount`). Login / signup accept a safe internal `?next=`
  (`nextParam`). `join` is in `RESERVED_SLUGS`.
- A person can belong to several shops: the header's `ShopSwitcher`
  (`team.switchShop`, usable shops only; also "Create your own shop" and
  "Leave"). Opening a team notification about another shop switches first.
- Seller pages follow the role through **one rule**, `pagePermission`
  (`seller-nav.ts`: the menu item's permission, plus stricter
  `EXTRA_PAGES`), enforced by `SellerPageGuard` in the dashboard layout;
  buttons check `viewer.permissions`. Plan locks for members use
  `billing.shopLimits` (`useShopLimits`); a member who can't manage the
  plan is told to ask the owner (`PlanLockCard`).
- **Activity history**: `shopActivity`, written **only** by
  `logShopActivity` (`convex/lib/shopActivity.ts`) in the same mutation
  (products, offers, codes, recorded sales, settings, look, Promo bar,
  change requests, team). Logged on every plan; read by `activity.list`
  (`ownActivity.view`, `teamRoles`, Business), kept
  `ACTIVITY_RETENTION_DAYS`. Recorded sales show `recordedBy`; product
  history shows `by`.
- Notifications to the team: `notify(ctx, { to: { shop } })` sends to the
  owner and usable members whose role has the type's `shopPermission`
  (`notifications/types.ts`); the row stores `shopId` and the inbox
  re-checks access to that shop on every read. Billing / plan types stay
  owner-only (`{ userId: shop.ownerId }`).
- `teamJobs.cleanup` (daily) deletes ended invites after `INVITE_KEEP_DAYS`
  and old activity; `admin/shops.purgeShop` purges members, invites and
  activity with the shop.

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
- Files are owned by a **shop**: attach them only through
  `claimImages(ctx, shop, ids)` and delete them only through
  `deleteFilesNotIn` (`convex/lib/seller.ts`). The `uploads` table records
  the shop (and uploader) that first attached each storage id, so the
  shop's team shares its photos and no other shop can attach — and later
  delete — them (rows without `shopId` belong to their uploader's shop).
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
- Shop pages carry **no Vano badge or "Create your shop" footer, in any
  plan**. Don't add one back.
- Product page (`/[slug]/[productId]`, shared by `/demo/[productId]`):
  one main photo (swipeable) with prev / next arrows and small
  thumbnails below it, on every screen size (`product-gallery.tsx`); every photo whole (`object-contain` on a
  `bg-muted` 4:5 tile, never cropped or zoomed), tap → full size
  (`product-lightbox.tsx`, prev / next, arrow keys). The info column is
  sticky on desktop: category, name, Sold out / Few left, price and sale
  (`sale.tsx`), size chips, colour dots, then Order on WhatsApp + share
  (`OrderPanel`, `ShareButton`), a fixed bottom bar on phones (the page
  leaves room for it). Description and Shop info are collapsible
  `ProductSection`s, shown only when filled (Shop info also follows the
  look's About switch). Photos, size chips and sections use 0–2px
  corners; buttons follow the look's shape.

## Marketing site

- Pages live in the `src/app/(marketing)/` group (Home, Features, Pricing,
  Demo, Help, Terms, Privacy). The group layout adds the announcement
  banner, `MarketingNav` and `MarketingFooter`; code is organised by page in
  `src/features/marketing/{shared,home,features,pricing,demo,help}`.
- Plan names, prices, limits, features, the trial length and the
  pricing-page text come **only** from the plan config (`plans.catalog`,
  see "Plans & features"). `src/features/marketing/pricing/plans.ts` holds
  no data: it derives the cards and the comparison table from the
  catalogue (server pages: `getPlanCatalog`; client: `usePlanCatalog`,
  `usePlanName`). A hidden plan is never listed. Never hard-code a plan
  name, price, limit or trial length in marketing text: pass it in.
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
  which also logs the change). New shops start a **Pro-only** trial in
  `shops.create` (no payment method), as long as the trial plan's
  `trialMonths` in the config; a "Get Business" sign-up
  (`startPlan: "business"`) gets no trial and starts on Free. Nothing
  renews automatically; a trial or plan keeps its features `GRACE_DAYS`
  (3) after its end, then the hourly cron `billingJobs.expireDue` moves it
  to Free.
- Prices and new periods come **only** from `quotePurchase`
  (`subscriptions.ts`), used by the plan dialog, `startCheckout` and
  `applyEvent`: same plan = +30 days after the end (trial → Pro: after the
  trial); a higher plan or from Free = today + 30 days (the trial ends); paid
  Pro → Business pays the price minus `upgradeCreditMinor` (paid days only,
  ≤ 30); downgrades are never charged and change nothing now. Every plan
  dialog shows the amount and the new end date (`plan-change-dialog.tsx`).
- **Every plan limit goes through `convex/lib/entitlements.ts`**:
  `requireCan(ctx, shop, action)` in mutations, `hasFeature` in queries,
  the pure `canShopDo` in the UI with the resolved `limits` from
  `billing.mine`. Never compare a plan name or hard-code a limit, and
  never read the seed (`planDefaults.ts`) to check a shop. A new paid
  feature = a key in `FEATURES` (`convex/lib/planFeatures.ts`, `enforced:
  true`) + seed values in `planDefaults.ts` + EN/FR `PlanFeatures.<key>`
  + a `requireCan({ kind: "feature" })` call.
- Downgrades never delete or change data: public visibility is computed
  (`visibleProductIds`: pinned first, then newest, up to the limit).
  Over-limit products stay editable; photos are capped publicly.
- Payments go through the `PaymentProvider` interface
  (`convex/payments/provider.ts`), registered in `payments/registry.ts`
  and chosen by the `PAYMENTS_PROVIDER` env var. Amounts come from the
  plan config's monthly price, never the client; a hidden plan can't be
  bought. Provider results (webhook
  `POST /payments/callback/<provider>`, status polls, the mock) are applied
  **only** by `applyEvent` in `payments/core.ts`, which dedupes event ids,
  never changes a final payment and extends a plan once (`appliedAt`).
- The mock provider runs only with `PAYMENTS_PROVIDER=mock` **and**
  `PAYMENTS_MOCK_ENABLED=true` on the deployment. Never set them on prod.
- Admins grant / extend plans with `billing.manage`, a reason, never on
  their own shop (`assertNotOwnShop`).

### Plans & features

- **The admin "Plans & features" page (`/admin/plans`) is the source of
  truth** for plan names, monthly / yearly prices, the trial length,
  visibility on the pricing page, which plan gets which feature, limits
  and the pricing-page text. One `planConfig` document, read only through
  `readPlanConfig` and written only by `writePlanConfig`
  (`convex/lib/planConfig.ts`). `convex/lib/plans.ts` keeps ids, statuses
  and fixed rules, never numbers.
- Feature **keys** live in code (`FEATURES` in `convex/lib/planFeatures.ts`:
  flag or limit, area, `enforced`, ceiling); admins can't invent keys.
  `enforced: false` = pricing page only. The seed (`planDefaults.ts`) is
  used only for a fresh deployment, new keys and "Reset to defaults".
- A higher plan always includes everything in the lower ones
  (`resolvedValue`); the trial counts as Pro. Shop exceptions
  (`planExceptions`, a feature or higher limit until a date, with a
  reason) are applied first by `getEntitlements`, end by themselves
  (`planExceptionJobs`) and are shown in the shop drawer.
- Admin writes need `plans.manage`, send the version they edited
  (`PLAN_CONFIG_STALE` warns the second admin), are validated again on the
  server and logged per field with old and new values. Before removing a
  feature or lowering a limit the UI shows `admin.plans.impact` (affected
  shops) and asks to confirm. Data is never deleted.

## Shop looks

- A look is **a preset plus optional per-facet overrides**
  (`StoredLook` in `convex/lib/looks/validators.ts`: `colors`, `buttons`,
  `banner`, `promo`, `profile`, `sections`, `announcement`). A missing facet means "the preset's". Later phases (fonts,
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
  `ShopLooks.*` / `LookEditor.*`. `classic` is the free look (square buttons, the default shape). Every preset
  must pass the contrast check with zero warnings (tested).
- `resolveLook` (pure) turns a look into the semantic tokens; text colours
  are derived, never picked (one exception: the Promo bar's custom
  colours, see below, always contrast-checked). `ShopLookScope` applies them inline (no
  flash); shop buttons use `shop-btn`, chips `shop-chip` (rules in
  `globals.css`). The WhatsApp order button keeps `--whatsapp`.
- One row per shop in `shopLooks` (`draft`, `published`), written only by
  `convex/shopLooks.ts` (seller: `saveDraft`, `publish`, `discardDraft`)
  and `admin/shopLooks.reset`. Values are re-checked with `cleanLook`;
  banner photos go through `claimImages` / `deleteFilesNotIn`.
- `publish` refuses a blocking contrast problem (`lookProblems`,
  `LOOK_CONTRAST`) and needs the `allLooks` plan feature for anything but
  the free look. Drafts save on every plan. What visitors see is one pure
  rule, `shownLook` (`clean.ts`), used by `visibleLook` and the editor's
  "Live now": the published look while the plan allows it, else the free
  look (plus the Free parts of the saved profile); the design is never deleted.
- Public queries return a resolved `PublicLook` (banner photo as a URL),
  never the draft or a storage id.
- Admins with `shops.resetLook` reset the banner (photo + text), the
  profile photo options or the whole look, with a reason, never on their own shop; it's logged
  (`shop.lookReset`) and the seller is notified (`look.reset`).

- Button designs (`convex/lib/looks/buttonDesigns.ts`: design, decoration
  icon, order label) are optional fields of the `buttons` facet, gated by
  `allLooks` like any override. They're drawn **only in CSS** (`globals.css`,
  `data-btn-design` / `data-btn-deco`) on `shop-action` buttons and
  `shop-chip` chips; decorations are corner pseudo-elements reusing the
  sticker SVGs, animations only under `prefers-reduced-motion:
  no-preference`. The WhatsApp button keeps `--whatsapp` and the WhatsApp icon (`WhatsAppIcon`); its
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
- Queries never read the clock: `shopLooks.promoLive` (and
  `decorationLive`) are stored by `publish` and `shopLookJobs.syncSchedules`
  (scheduled at start / end, idempotent; `syncPromo` is its old alias,
  kept for queued jobs); `endPromoNow` ends the promo at once. Rules (`scheduleProblem`,
  `PROMO_MAX_DAYS`) in `convex/lib/looks/schedule.ts`.
- Publishing a promo needs `salesPromotions`; public pages show it only
  while live and entitled (`visibleLook`). Admin "banner" reset removes it.

### Profile photo

- The optional `profile` facet (`convex/lib/looks/profile.ts`): shape,
  border (width, style, colour: a shop colour token or a custom hex),
  size, position, overlap with the banner, corner decoration and one
  optional decoration with optional dates. Ids, data, rules and geometry
  live **only** there; names in `LookEditor.profile.*` and
  `ProfileDecorations.*`, badge words in `Public.profileBadges.*` (shop
  language). A missing facet = `DEFAULT_PROFILE` (today's circle).
- Free publishes `isFreeProfile` only (circle, thin or no solid border in a
  shop colour, nothing else); the rest needs `allLooks`. A downgrade shows
  `freeProfileOf(saved)`; the choice is kept.
- `ProfileAvatar` (`src/features/shop-looks/profile/`) is the one drawing,
  used by the public header, previews, editor tiles and the product page.
  Shapes and decorations are original inline SVG; the photo is always
  cropped around its centre and inset inside the border, so borders never
  cover it. Decorations are placed by `decorationBox` / `cornerBox`, never
  in the face zone and inside the drawing area for every shape × size
  (tested). Adding a decoration = an id + entry in `profile.ts`, its art in
  `decorations/art.tsx`, EN/FR names. Animations only under
  `prefers-reduced-motion: no-preference`. The soft glow border is a
  seller-chosen shop style, like Sticker, an exception to "no shadows".
- The border colour is covered by the contrast check (`profileBorder`,
  3:1 against the page, a warning with a one-tap fix).
- Picking an event banner suggests its decoration (`decorationForTemplate`)
  with one tap, taking the banner's dates; never applied by itself.
- The banner, the profile photo, the name and the product grid share one
  left edge: `SHOP_BANNER_EDGE` (`shop-banner.tsx`), no extra header padding.

### Sections, layout, Promo bar, filters, About and contact

- The optional `sections` facet (`convex/lib/looks/sections.ts`): the
  ordered section list (`sale`, `newArrivals`, `featured`, `backInStock`,
  one `category` per picked category, `all`), the product layout
  (`grid2 | grid3 | large`) and the About switch. A missing facet =
  `DEFAULT_SECTIONS` (All products, 2 columns, About on).
  `buildShopSections` is the one rule for what shows (off or empty
  sections never; Sale only while a sale is live; a section that only
  repeats All products is skipped; never a blank shop), used by the
  public page, the previews and the demo through `ShopSections`
  (`src/features/public/shop-sections.tsx`). Layout classes live only in
  `product-layout.ts` (the default `grid2`: 2 columns on phones, 3 on
  tablets, 4 on computers; phones never more than 2, 1 for big cards;
  cards keep their size and stay left-aligned, however few products).
- Product cards (`product-card.tsx`): a soft tinted card (`bg-muted` of the
  look, **no border, no shadow**: the one exception to the surface border
  rule, from the seller-facing reference design), a 4:5 photo area (the
  whole photo fits, never cropped or zoomed; small corners, ≤ 6px) and
  **one** badge, the first that applies (`cardBadge`: Sold out, sale
  "-N%" / "Sale", "New" for `NEW_BADGE_DAYS` = 14, section label, Few
  left): a sale is a scalloped seal inside the card's top-right corner
  (`SaleSeal`, `--chip` tokens, static), the others a pill on the photo's
  top-left; the name on one line with the prices right under it
  (old price crossed out), colours as dots
  (`colorSwatch`, unknown names as chips) and sizes as chips in one row,
  no description; the compact Order button with a square share button
  (`useShare`) beside it. The whole card opens the product (stretched name link);
  share and Order sit above it. The compact WhatsApp Order button keeps
  the look's design but 10px corners (`--shop-btn-radius` set inline).
  Buttons need a `ShopOrderProvider`. "New" is computed by the page with
  `isNewProduct` (Convex queries never read the clock). The message is
  built only by `orderHref`
  (`src/lib/whatsapp.ts`, also used by `OrderPanel`) with the live price
  from `public.shopPrices` (one subscription per page). Card WhatsApp taps
  use `stats.recordWhatsappClick`. The shop header has no buttons.
- The header leaves room for profile decorations from `avatarOverflow`
  (`profile.ts`), so nothing crosses the shared left edge.
- Free publishes `isFreeSections` only (All products in 2 columns, any
  About choice); the rest needs `featuredSections`. A downgrade shows
  `freeSectionsOf(saved)`; the choice is kept.
- **Promo bar** (`PromoBar`, `src/features/public/promo-bar.tsx`): one
  slim line, sticky at the top of the shop page and full width (edge to
  edge, content aligned to the page column), the one place for the sale strip and
  the seller's message. What it says is one pure rule,
  `promoBarContent` (`announcement.ts`): a running sale wins (seller's
  title or "Sale", the discount from `promoSaleSummary`, the countdown,
  "View sale" → `?sale=1`), then the seller's text, else hidden. A
  running sale shows even without a configured bar (plain card style;
  sales are already paid); style, icon, title, countdown and close
  switches apply only while the bar is live and entitled.
- Its settings are the optional `announcement` facet (key kept, every
  field added since optional, so stored bars keep working): text (may be
  empty = sale-only), optional link (`sale`, or an https URL cleaned by
  `cleanAnnouncementUrl`), a shop colour `tone` **or** custom
  `colors` (background + text: the seller picks the text colour here;
  `lookProblems` refuses < 4.5:1 on every stop, fix `announcementText`),
  `style` (`solid | gradient | outline`; the gradient's second stop moves
  away from the text, `promoGradientEnd`), `icon`, `title`, `countdown`,
  `closable`, and optional dates with the event banner rules. Needs
  `announcementBar`; `shopLooks.announcementLive` is stored by
  `savePromoBar` / `syncSchedules` like `promoLive`. Visitors close it for the visit
  when allowed (session storage, wrapped in try/catch).
- It is **edited on the Offers page** (`src/features/sales/promo-bar-editor.tsx`:
  live preview with the shop's look and the real sale, `promo-bar-form.tsx`
  options, one Save / Discard), read with `shopLooks.promoBar` and saved,
  live at once, by `shopLooks.savePromoBar` (into the published look and the
  draft; plan, dates, contrast re-checked; null removes it on any plan). The
  Look editor never changes it: `saveDraft` / `publish` keep the published
  bar (`withPublishedBar`), and its "Promo bar" tab is only an "Edit in
  Sales" link (`promo-bar-moved.tsx`).
- **Filters** (`src/features/public/filters/`): **one slim row** —
  category chips, a Sale chip (only while a sale runs), sort (newest =
  the page's order, price low → high / high → low on the price paid
  now) and a "Filters" button with a count badge, which opens a side
  sheet (computers) / bottom sheet (phones) mounted inside the look
  scope: search, price (quick ranges from the shop's real prices,
  `priceRanges`, then min / max), category, size, colour, On sale and
  New switches. Only values the shop's products have are shown. Under
  the row, while filtering: removable active-filter chips, the result
  count and "Clear all"; one results grid (friendly empty state)
  replaces the sections.
- What a shop offers is **one rule**, `filterAccess`
  (`convex/lib/looks/filters.ts`): the look's `sections.filters` setting
  (`auto` = full filters from `FULL_FILTERS_MIN_PRODUCTS` (8) products,
  else sort + Sale; `on`; `off` = no row; free on every plan, a missing
  field = `auto`), the visible product count and the `shopFilters` plan
  feature (Free: category chips + sort; Pro / trial: everything).
  `public.shopBySlug` computes it on the server (`filters`); the page
  drops everything else from the link with `limitShopFilters` before
  rendering. The demo and the Look preview call the same rule.
  Rules are pure in `shop-filters.ts` (`parseShopFilters`,
  `shopFiltersToQuery`, `limitShopFilters`, `applyShopFilters`,
  `activeFilterChips`). Filters live in the link (`q, cat, sale=1,
  new=1, sort, size, color, cond, for, min, max`; prices in major units through the
  money helpers): the page parses them on the server, `useShopFilters`
  writes them back with `history.replaceState`. Public products carry
  every size and colour; the card shows `CARD_TAGS_MAX`. Condition
  (`cond`) and audience (`for`) are panel groups, shown only when some
  product uses them (`filterOptions`).
- `shownLook` gates each part on its own feature (`allLooks`,
  `salesPromotions`, `featuredSections`, `announcementBar`); a preset
  change never drops the sections or the Promo bar (`ownParts`).
- About and contact data (opening hours, delivery areas, social handles)
  is shop data, edited in Shop settings (`shops.update`), cleaned by
  `convex/lib/shopInfo.ts` (handles stored, links built by `socialUrl`).
  `ShopInfo` shows only the filled parts, and only when there's something
  the header doesn't show (hours, delivery areas or a social link).
- Product flags: `featured` and `fewLeft` are seller switches
  (`products.setFeatured` / `setFewLeft`) — except that a product whose
  pieces are tracked gets `fewLeft` / `soldOut` from its count (see
  "Sales tracking"; the switches are refused with `STOCK_TRACKED`).
  "Back in stock" is set when
  Sold out is turned off (`lib/restock.ts`, `stockChange`) and cleared
  after `RESTOCK_DAYS` by `productJobs.endBackInStock` (idempotent on
  `restockedAt`). Sold out clears both.
- Admin reset: "banner" also removes the Promo bar; "all" goes back
  to `FREE_LOOK` (default sections and layout, no bar).

## Sales

- A sale is **a temporary price on top of the real price**: the `sales`
  table (one row per sale: discount, target, dates, display options),
  written only by `convex/sales.ts` (seller, `ownProducts.manage`),
  `admin/sales.ts` and `saleJobs.ts`. Never change `products.price` for a
  sale; the crossed-out price is always the real normal price.
- Rules live **only** in `convex/lib/sales/` (pure): `discountedPrice`
  (percent 1–90, amount / set price lower than the price and above zero,
  percent rounded with `roundPrice` from `money.ts`), `bestSaleFor` (the
  best price for the customer wins), `saleLiveAt` / `saleStatusAt`,
  `saleScheduleProblem` (the event banner limits plus an end in the
  future), presets. The editor, the shop and the server use the same
  ones. Over 80% off needs `steepConfirmed`. A future discount code reuses
  `saleDiscountValidator` + `discountedPrice` (see "Discount codes").
- Queries never read the clock: `sales.live` is stored by every write
  (`writeLiveAndSchedule`) and kept by `saleJobs.sync`, scheduled at the
  start, end − 24 h and end (idempotent; it also sends `sale.started` /
  `sale.endingSoon` / `sale.ended`); the hourly `saleJobs.sweep` is the
  safety net. Public reads use `liveSalesFor` (live **and**
  `salesPromotions`), and return `publicSale(...)`, never the sale row.
- The order button re-reads `public.productPrice` live, so the WhatsApp
  message carries the price at tap time (`orderSalePrice` +
  `orderSaleNote` when on sale). The browser clock only drives the
  countdown display.
- Edits send `expectedVersion` (`SALE_STALE` if someone saved meanwhile).
  `deleteProduct` removes the product from sales (`forgetProductInSales`);
  deleting a sale deletes its `saleDailyStats`.
- Shop display uses `SalePrice` / `SaleTags` / `SaleCountdown`
  (`src/features/public/sale.tsx`): price in `--shop-price`, old price
  `--muted-foreground`, badge with the `--chip` tokens (`shop-btn`), label
  `shop-chip chip-selected`, so the look's buttons, decorations and
  contrast check apply (cards show one badge, `cardBadge`). The "Sale"
  filter, the Promo bar's sale and the event banner's sale link
  (`promo.link = "sale"`) only exist while a sale runs.
- Per-sale views / clicks go in `saleDailyStats` (bumped by
  `stats.record*` for the product's current best sale).
- Admins with `shops.manageSales` pause or delete a sale with a reason,
  never on their own shop; logged (`sale.adminPaused` /
  `sale.adminDeleted`) and the seller is notified (they may resume).

## Discount codes

- A code is **a temporary price a customer unlocks on the product page**,
  on top of the real price (never changed): the `discountCodes` table
  (code upper case, unique per shop, `by_shopId_and_code`; percent or
  amount off; the sale target; dates; optional `maxUses`; `uses`),
  written only by `convex/discountCodes.ts` (seller, `ownProducts.manage`),
  `admin/discountCodes.ts`, `discountCodeJobs.ts` and the public
  `redeemDiscountCode` (uses).
- Rules live **only** in `convex/lib/discountCodes/` (pure) and reuse the
  sale ones: `discountedPrice`, `saleAppliesTo`, `saleScheduleProblem`
  (dates entered in the seller's zone with `ScheduleFields`, stored UTC).
  `normalizeCode` / `codeTextProblem` (3–20 letters and digits, not case
  sensitive), `suggestCode`, `maxUsesProblem`, `codeStatusAt` (ended →
  used up → paused → scheduled / running), `evaluateCode`.
- **Business only**: the `discountCodes` plan feature. `requireCan` on
  create / update / resume (pause and delete on any plan); public reads go
  through `liveCodesFor` (live **and** `hasFeature`), so a downgrade turns
  codes off and hides the field; codes are never deleted.
- Queries never read the clock: `discountCodes.live` is stored by every
  write (`writeCodeLiveAndSchedule`), by `discountCodeJobs.sync` at start /
  end, by a use that reaches the maximum, and the hourly `sweep`.
- The product page shows "Have a discount code?" only when
  `public.productPrice.codeField` is true (a live code lowers this
  product). Never return the code list, `ownerId` or a storage id.
- The server computes every price: `public.checkDiscountCode` (Apply,
  counts nothing) and `public.redeemDiscountCode` (Order: re-checked,
  `maxUses` enforced in the transaction, one use per visitor × product in
  `discountCodeUses`). The best of sale and code wins, never both
  (`saleBetter`). Results are returned, never thrown, so the guessing
  limits aren't rolled back.
- Guessing limits (`rateLimits.ts`): `discountCodeVisitor` (per shop ×
  random browser id, `src/lib/visitor-id.ts`) and `discountCodeShop`.
  Only wrong attempts consume; a visitor or shop out of tokens gets
  `tooMany` before any code is read. No IP or user agent is stored.
- The WhatsApp message carries the code, the normal and the final price
  (`orderHref` with `code`); the Order tap opens the tab first, then
  points it at the server-confirmed message.
- Uses show in the codes list and the stats page (`stats.summary.discountCodes`).
- Admins with `shops.manageDiscountCodes` pause or delete a code with a
  reason, never on their own shop; logged (`discountCode.adminPaused` /
  `adminDeleted`) and the seller is notified. Deleting a code purges its
  uses in batches (`discountCodeJobs.purgeUses`); deleting a product
  removes it from codes (`forgetProductInCodes`).
- The sale and code editors share `TargetFields` / `DiscountFields`
  (`src/features/sales/`); admin moderation dialogs share `ModerateDialog`;
  plan locks use `PlanLockCard`.

## Sales tracking

- **Naming**: "sales" in code means promotions (`sales` table,
  `convex/sales.ts`, `Sales.*` texts), shown to sellers as **Offers**
  (`/dashboard/offers`). A sale a seller *made* is a **recorded sale**:
  the `salesRecords` table, `convex/salesRecords.ts`,
  `convex/lib/salesRecords/`, `src/features/sales-records/`,
  `SalesRecords.*` texts, shown as **Sales** (`/dashboard/sales`). Never
  mix the two.
- A recorded sale is written only by `convex/salesRecords.ts` ("Mark as
  sold": `record`, `update`, `reverse`) and purged only with its shop
  (`admin/shops.purgeShop`). It stores a **snapshot** (product name,
  first photo, category, size, colour, currency, normal price per item,
  final price per item, quantity, `total`, `discount`, the `offer` —
  running sale or code —, `source` and `unitCost`, the product's cost
  price, private, never returned by the lists yet), so reports stay right after the
  product is edited or deleted. Never read the product to report a sale.
  The product's real price is never changed.
- Prices: `suggestedPrice` (best of `saleForProduct` and `evaluateCode`
  for the customer, never both) prefills the dialog; the seller may type
  another price (negotiated, above or below). `recordTotals` gives
  `total` and `discount` (never negative). Rules (quantity 1–999, date
  within two years and not in the future, size / colour required when the
  product has them, customer name / phone) live only in
  `convex/lib/salesRecords/rules.ts`, used by the Zod schemas and the
  server. Codes don't count a use (the customer's Order tap did).
- **Sold out** and the pieces count change only through
  `lib/productStock.ts` (`applyStock` / `stockUpdate` / `applyPieces`),
  used by `products.setSoldOut`, `products.update` and recorded sales, so
  every change lands in `productEvents` (the product's history: sold out,
  back on sale, sold, sale edited / reversed, deleted).
- **Pieces in stock**: `products.pieces`, **required by the product form
  on every plan** (at least 1 for a new product, `piecesProblem`; missing
  only on products saved before, which are never blocked on the shop but
  must get one on their next save), rules only in `convex/lib/stock.ts`
  (`stockFlags`, `takePieces`, `FEW_LEFT_MAX` = 3, `isTracked`). Tracked
  = a count and the `stockManagement` plan feature (without it the count
  is stored but ignored and the manual switches work, as after a downgrade).
  While tracked: "Few left" at 3 or fewer, "Sold out" at 0, each recorded
  sale takes its quantity (never more: `SALES_RECORD_STOCK`) and stores
  `piecesTaken`; an edit takes or gives back the difference; a reverse
  gives the pieces back (no longer sold out). Taking the last piece sets
  `markedSoldOut` and notifies the seller (`product.soldOut`, with "Hide
  product"). The sale modal has no sold-out switch; untracked products
  don't change when sold.
- **Product details** (same on every plan): `products.costPrice` is
  required by the form (minor units, 0 or more, `costPriceProblem`),
  **private**: never in a public query, returned by `products.getMine`
  only with `ownProducts.manage`, copied into recorded sales as
  `unitCost`. Optional `condition` (`new | thrift`) and `audience`
  (`women | men | kids`), keys in `convex/lib/catalog.ts`, labels
  `Public.conditions.*` / `Public.audiences.*`: Thrift is the last card
  badge (`cardBadge`), the product page shows the condition beside the
  category (`ConditionTag`), both are shop filters. Optional `code`:
  rules only in `convex/lib/productCode.ts` (normalised upper case,
  unique per shop through `by_shopId_and_code` → `PRODUCT_CODE_TAKEN`,
  `suggestProductCode` = category prefix + next running number, served
  by `products.suggestCode`); shown on seller screens and added to the
  WhatsApp message (`orderHref` `productCode`), never on the shop page.
  The form keeps these three under a closed "More details".
- A sold-out product can't be ordered: `public.productPrice` /
  `shopPrices` return `soldOut` live (the Order buttons turn off on an
  open page), `redeemDiscountCode` / `checkDiscountCode` return
  `soldOut` (no use counted) and WhatsApp clicks aren't counted.
- **Hidden by the seller**: `products.hiddenBySeller`
  (`products.setHiddenBySeller`, any plan; the seller can show it
  again), separate from the admin's `hidden` (the seller can't undo it).
  Every customer-facing check uses `hiddenFromShop` (`entitlements.ts`);
  admin screens read `hidden`.
- Deleting a product never deletes its sales or history.
  `deleteFilesNotIn` keeps a photo still used by a recorded sale; it goes
  when the shop is purged.
- A reversed sale stays listed (`status: "reversed"`) and is excluded
  from every total (`sumRecords`). Edits send `expectedVersion`
  (`SALES_RECORD_STALE`); a reversed sale can't change.
- **Business only**: the `salesReports` plan feature. `requireCan` on
  every write, `hasFeature` in every read (`locked`). A downgrade hides
  sales, never deletes them.
- **Dates**: each sale stores `soldAt` (UTC) and `day` ("YYYY-MM-DD" in
  the shop's time zone, `shops.timeZone`, IANA, `lib/timeZone.ts`; UTC
  until set). Reports group by `day` (`by_shopId_and_day`). The zone is
  set from the browser at sign-up or on the first sale, and edited in
  Shop settings; `src/lib/local-time.ts` shares its maths.
- **Customer data** (name, phone): returned to sellers only with
  `ownCustomers.view` (a future team role may lack it); recording needs
  `ownSales.manage`. Admins see totals with `shops.view`; names and
  phones need `shops.viewCustomers` and a reason, never on their own
  shop, through the `admin/salesRecords.revealCustomers` mutation, which
  logs `salesRecord.customersViewed` in the same transaction.
- **Reports** (`/dashboard/reports`, `convex/reports.ts`, Business via
  `salesReports`): one month ("YYYY-MM") in the shop's time zone — a day
  range on each sale's stored `day`, so zone maths is never redone. Rules
  only in `convex/lib/salesRecords/report.ts` (`buildReport`, `change`,
  `monthRange`, `previousMonth`, `currentMonth`): confirmed sales only,
  from the snapshot, compared with the previous month. WhatsApp taps come
  from `shopDailyStats` (UTC days) and are shown as taps, never revenue.
  The CSV reuses `salesRecords.listMine` (`src/features/reports/csv.ts`);
  Print shows a print-only summary (`print:` + `data-print-hide` on the
  seller shell). `reportJobs.monthly` (daily cron at a fixed UTC hour)
  sends `report.ready` on each shop's local 1st, only with the plan and
  at least one confirmed sale, deduped per shop and month.
- "Mark as sold" is one dialog (`RecordSaleDialog`) opened from the
  product list menu, the product page and the Sales page ("Record a
  sale" → `PickProductDialog`). The Sales page keeps its filters in the
  address (`range`, `from`, `to`, `source`, `product`, `q`, `open`).

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
- A type may have one action of its own (e.g. "Hide product" on
  `product.soldOut`), drawn by `notification-action.tsx` beside the row's
  link (never inside it) on the inbox page and in the bell.
- Outside delivery (WhatsApp, email) implements `NotificationChannel`
  (`convex/notifications/channel.ts`), registered in `registry.ts` and
  enabled by `NOTIFY_CHANNELS`; `notify` schedules it. Features don't change.

## Emails

- **One way to send**: `sendEmail(ctx, { to, subject, html, text })`
  (`convex/emails/send.ts`), from a mutation or an action. It only
  schedules `emails.send.deliver`, so a slow or failing provider never
  blocks or fails the user's action. Never call a provider directly.
  The one exception is `sendEmailNow` (same file, actions only), for auth
  codes, where the person waits on screen for the result (see "Auth codes").
- Providers implement `EmailProvider` (`convex/emails/provider.ts`: never
  throw, return `retryable` or not), registered in `emails/registry.ts`.
  Resend is called with `fetch` (no SDK). Settings are Convex env vars
  only: `RESEND_API_KEY` + `EMAIL_FROM` (both, or **log mode**: the email
  is written to the Convex logs, never sent), optional `EMAIL_REPLY_TO`.
  A missing config never crashes.
- Temporary failures (network, 429, 5xx) retry up to `EMAIL_MAX_ATTEMPTS`
  with `EMAIL_RETRY_DELAYS_MS` (`emails/config.ts`) and the same
  idempotency key, so a retry never sends twice; other errors are logged
  once. Logs mask addresses (`maskEmail`).
- One layout, `renderEmail` (`emails/layout.ts`): table layout, inline
  styles, plum Vano bar, plain-text version, every value escaped, http(s)
  buttons only. `EMAIL_COLORS` mirrors `globals.css` (tested). A new email
  = a template in `convex/emails/templates/` (`(language, values) →
  { subject, html, text }`) + EN/FR texts in `Emails.<name>.*`, read with
  `emailTexts` / `fill`, in the **recipient's** language.
- Admin Settings has "Send test email" (`admin/emails.sendTest`,
  `settings.manage`, rate limited `testEmail`, logged
  `settings.testEmail`): it goes only to the caller's own address, never
  to one from the browser.
- **Welcome email** (`emails/welcome.ts`, template `welcome.ts`): sent by
  `shops.create` in the same mutation, so only new shop owners get it
  (never people joining an existing shop), in the shop's language, with
  the trial length and plan name from the plan config (no trial line for
  a "Get Business" sign-up). Once per account (`users.welcomeEmailSentAt`);
  it never throws (no address or no `SITE_URL` = skipped), so sign-up
  never fails because of it. Links use the `SITE_URL` env var.
- **Plan emails** (`docs/payments.md` section 15): the upgrade / renewal
  receipt, sent **only** by `applyEvent` when it applies a confirmed payment
  (`payments.receiptEmailAt`), and the downgrade / switch-to-Free
  confirmation, sent by `billing.scheduleDowngrade` (one `planChanges` row
  per change, `emailSentAt`, "Keep my plan" = `billing.keepPlan`). To the
  owner in the shop's language; never for failed payments or admin
  changes. Rules in `convex/lib/planEmails.ts` (dates in Nairobi time,
  `formatBillingDate`), senders in `convex/emails/planEmails.ts` (never
  throw); names and prices from the plan config, phones through `maskPhone`.
- **Trial reminder emails** (`docs/payments.md` section 14): 7 days left,
  2 days left and "now on Free", to the owner in the shop's language.
  Rules **only** in `convex/lib/trialEmails.ts` (`dueTrialEmail`); the
  daily cron `trialEmailJobs.plan` (06:00 UTC = 09:00 Nairobi) schedules
  them, at most `TRIAL_EMAILS_PER_DAY` (70), one a minute, most urgent
  first; each `trialEmailJobs.send` re-checks the live subscription and
  records the email in `trialEmails` (shop × kind × trial end) in the same
  transaction, so it goes once. "Now on Free" needs `subscriptions.trialEndedAt`
  (set by `expireIfDue`). Content comes from real data and the plan config
  (`includedCardLines`, `shopDowngradeImpact`, `formatPlanPrice`), never
  hard-coded.

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
- **Charts** (seller Reports): one hue, `--chart` (`bg-chart`, checked
  for 3:1 on cards), thin bars with 4px rounded ends on the baseline, a
  hidden table with the same numbers, growth only under `motion-safe:`.
  Number tiles use the shared `StatTile` (`src/components/stats/`).
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
  `shop-looks`, `sales`, `sales-records`, `discount-codes`, `billing`, `change-requests`, `notifications`, `seller-nav`, `team`, `activity`, `admin/*`).
  Generic primitives live in `src/components/ui/`.
- Admin pages live under `src/app/admin/` and wrap their content in
  `<RequirePermission permission="…">`. Sidebar sections are defined only
  in `src/features/admin/shell/nav.ts` (flip `ready` when a page ships).
  Hiding a link or button is never security — the Convex function checks.
- **Seller menu**: one list, `SELLER_NAV` (`src/features/seller-nav/seller-nav.ts`:
  key, icon, link, group, permission, plan `feature`, `badge`, `mobile`, `ready`)
  with labels in `Seller.nav.<key>`. The desktop sidebar, the phone bottom bar
  and its "More" sheet all read it; adding a page = one line. `ready: false`
  items never show; a `feature` the plan lacks shows a lock and still opens the
  page (which explains the plan). Badges come from real tables
  (`useSellerNavCounts`), never from notifications. Menus are drawn by the
  shared `SideNav` (`src/components/shell/nav/`), also used by the admin
  sidebar. Phones reserve the bottom bar with `--bottom-bar`: sticky footers
  use `bottom-[var(--bottom-bar,0px)]`, never `bottom-0`.
- **Lists** (admin and seller) use the shared `DataTable`
  (`src/components/data-table/`); a page only defines its columns, its pure URL spec (`table-spec.ts`:
  filter keys, options, defaults) and labels (`filterDefs`). Never build a
  list, filter bar, pagination or date input by hand. Filters, search,
  page, page size, sort and the open row live in the URL (`useTableState`,
  pure codec in `url-state.ts`); a record opens in `DetailsDrawer`
  (`?open=<id>`, admin links built only by `adminHref`); old
  `/admin/<list>/<id>` routes redirect there. Only the date column sorts,
  on the server (`order` arg, `convex/lib/listOrder.ts`). Statuses use
  `StatusTag` (one tone map in `status-tones.ts`). A list whose days are
  in the shop's time zone (recorded sales) passes `timeZone` to its date
  filter; admin lists stay in UTC.
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
  auth.ts auth.config.ts http.ts   # Convex Auth (Password, sign-up enabled, email codes)
  authCodeJobs.ts   # deletes expired sign-up / reset codes
  users.ts shops.ts products.ts files.ts public.ts stats.ts
  shopLooks.ts      # shop look draft / publish (lib/looks/: model, presets, contrast, sections)
  productJobs.ts    # ends "Back in stock"
  sales.ts saleJobs.ts   # seller sales, start/end jobs (lib/sales/: rules)
  salesRecords.ts        # recorded sales (lib/salesRecords/: rules)
  discountCodes.ts discountCodeJobs.ts   # discount codes (lib/discountCodes/: rules)
  changeRequests.ts changeRequestJobs.ts   # protected shop changes
  team.ts teamJobs.ts activity.ts          # team accounts, invites, activity history
  notifications/    # notification types, inbox, config, outside channels
  notificationJobs.ts                     # ending-soon warnings, cleanup
  emails/           # sendEmail, providers (Resend / log), layout, templates
  verification/     # swappable code senders
  billing.ts billingJobs.ts crons.ts   # seller billing, expiry job
  trialEmailJobs.ts # trial reminder emails (lib/trialEmails.ts: rules)
  plans.ts planExceptionJobs.ts        # public plan catalogue, exception expiry
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
