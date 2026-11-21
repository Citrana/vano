# Payments, plans and billing

The reference for how Vano's subscriptions and payments work. **Keep it in
sync with the code**: any change to payments, plans, trials, limits,
providers, checkout, the scheduled jobs or billing admin updates this file
in the same commit, with a dated entry in the change log below
(see CLAUDE.md "Billing").

**Last updated: 2026-11-20 08:09 CAT (UTC+02:00)**

## Change log

Newest first. Format: `YYYY-MM-DD HH:MM TZ — what changed (files)`.

- **2026-11-20 08:09 CAT (UTC+02:00)**: the `salesPromotions` feature now
  also gates **product sales** (CLAUDE.md "Sales"). `sales.create`,
  `update`, `duplicate` and `resume` call `requireCan(ctx, shop, { kind:
  "feature", feature: "salesPromotions" })`; pause and delete work on
  every plan. Public reads show a sale price only while the plan includes
  it (`liveSalesFor` → `hasFeature`), so after a downgrade running sales
  stop showing and normal prices return; the saved sales are kept and
  show again after an upgrade. No change to plans, prices or payments
  (`convex/sales.ts`, `convex/lib/sales/`, `convex/public.ts`).

- **2026-11-19 20:54 CAT (UTC+02:00)**: **the admin "Plans & features" page is now the source
  of truth** for plan names, monthly / yearly prices, the trial length,
  which plan gets which feature, the limits, the pricing-page text and
  whether a plan is shown. They live in one `planConfig` document, read
  through `readPlanConfig` and written only by `writePlanConfig` (version
  check: a second admin saving an old version gets `PLAN_CONFIG_STALE`).
  `convex/lib/plans.ts` keeps ids, statuses and fixed rules only;
  `PLAN_PRICE_MINOR`, `PLAN_LIMITS`, `TRIAL_MONTHS` and `PlanFeatureFlag`
  are gone. Feature keys are defined in code (`convex/lib/planFeatures.ts`,
  `FeatureFlag` = enforced flags); `convex/lib/planDefaults.ts` is the
  **seed only** (fresh deployment, new keys, "Reset to defaults"). The
  central check (`getEntitlements`) resolves the effective plan from the
  config (a plan includes everything in the lower ones) and applies the
  shop's live **exceptions** first (`planExceptions`: a feature or a
  higher limit until a date, with a reason; ended by
  `planExceptionJobs.expire` / the hourly `sweep`). Checkout amounts come
  from the config's monthly price; a hidden plan can't be bought
  (`PLAN_INVALID`). The trial length for new shops comes from the trial
  plan's `trialMonths`; running trials keep their end date. `billing.mine`
  returns the resolved limits (the UI no longer reads a plan table). New
  public query `plans.catalog` feeds the pricing page, the comparison and
  the seller's plan options. Admin writes need `plans.manage` (new
  permission) and are logged field by field with old and new values; a
  change that removes a feature or lowers a limit shows how many shops it
  affects first (`admin.plans.impact`, capped at 5 000). Nothing changes
  for existing shops: `migrations:plansV1` (optional, idempotent) stores
  the seed, which equals the old numbers. (`convex/lib/planFeatures.ts`,
  `convex/lib/planDefaults.ts`, `convex/lib/planConfig.ts`,
  `convex/lib/planValidators.ts`, `convex/lib/planCatalog.ts`,
  `convex/lib/plans.ts`, `convex/lib/entitlements.ts`,
  `convex/lib/subscriptions.ts`, `convex/billing.ts`,
  `convex/payments/core.ts`, `convex/plans.ts`, `convex/admin/plans.ts`,
  `convex/admin/planExceptions.ts`, `convex/planExceptionJobs.ts`,
  `convex/crons.ts`, `convex/migrations.ts`, `convex/schema.ts`,
  `src/features/admin/plans/*`, `src/features/marketing/pricing/*`)

- **2026-11-19 19:55 CAT (UTC+02:00)**: the `allLooks` feature now also
  covers the profile photo (`overrides.profile` on a look). Free can
  publish a circle with a thin (or no) solid border in a shop colour
  (`isFreeProfile`, part of `isFreeLook`); other shapes, borders, sizes,
  positions, corner decorations and decorations (crowns, events, everyday,
  with optional dates) need `allLooks` at publish, like any custom look.
  Drafts save on every plan. A shop without the feature shows the free
  look with the Free parts of its saved profile (`freeProfileOf`, in the
  shared `shownLook` rule); the saved choice is kept. A scheduled
  decoration is live only between its dates (`shopLooks.decorationLive`,
  set by `shopLookJobs.syncSchedules`, which replaces `syncPromo`; the old
  name stays as an alias). Pricing label updated. No plan, price or limit
  changed. (`convex/lib/looks/profile.ts`, `convex/lib/looks/presets.ts`,
  `convex/lib/looks/clean.ts`, `convex/shopLooks.ts`,
  `convex/shopLookJobs.ts`, `convex/lib/looks/store.ts`, `messages/*.json`)

- **2026-11-19 16:32 CAT (UTC+02:00)**: the `salesPromotions` feature is
  now enforced for event & promo banners (`overrides.promo` on a look).
  `shopLooks.publish` calls `requireCan({ kind: "feature", feature:
  "salesPromotions" })` when the draft has one; drafts save on every plan.
  Public pages show it only while it's live (`shopLooks.promoLive`, set by
  `shopLookJobs.syncPromo` at its start / end) and the plan has the
  feature; otherwise the normal banner (or the free look) shows and the
  banner is kept. Downloads are gated in the editor only (made in the
  browser, nothing stored). Pricing hint updated. (`convex/shopLooks.ts`,
  `convex/shopLookJobs.ts`, `convex/lib/looks/store.ts`, `messages/*.json`)

- **2026-11-19 12:39 CAT (UTC+02:00)**: the `allLooks` feature is now
  enforced. `shopLooks.publish` calls `requireCan({ kind: "feature",
  feature: "allLooks" })` for any look other than the free one (Classic,
  nothing changed). Drafts save on every plan. Public pages show the
  published look only while `hasFeature(shop, "allLooks")`; otherwise they
  show the free look and the saved design is kept. (`convex/shopLooks.ts`,
  `convex/lib/looks/store.ts`, `convex/public.ts`)

- **2026-11-19 09:40 CAT (UTC+02:00)**: `/admin/subscriptions` on the shared data
  table: sort by end date, filters in the URL; a row opens the shop drawer
  (plan panel with grant / extend). The old billing filter components are
  gone. (`src/features/admin/billing/subscriptions-section.tsx`)

- **2026-11-19 09:40 CAT (UTC+02:00)**: admin billing lists move to the
  shared admin data table. `admin.billing.payments` and
  `admin.billing.subscriptions` take an optional `order` (`asc | desc`;
  defaults unchanged: payments newest first, subscriptions soonest ending
  first; ignored while searching). New `admin.billing.payment` (one
  payment by id, `billing.view`) feeds the payment drawer. Filters, page
  and the open row live in the URL; the failed-payment notification opens
  the payment (`?status=failed&search=<shop>&open=<paymentId>`). No change
  to money, plans or providers. (`convex/admin/billing.ts`,
  `convex/lib/listOrder.ts`, `convex/notifications/types.ts`,
  `src/features/admin/billing/*`)

- **2026-11-19 08:43 CAT (UTC+02:00)**: billing notifications (in-app,
  via the central `notify` service). `writeSubscription` tells the seller
  when a plan is activated / granted / extended or when it (or the trial)
  ends; a failed payment reaches the payer and every `billing.view` admin;
  a new daily cron `notificationJobs.endingSoon` warns sellers whose trial
  or plan ends within `EXPIRY_WARNING_DAYS` and sends admins a daily
  summary. Admin "needs attention" counts (`admin/attention.counts`):
  unresolved failed payments and plans ending soon. See section 13.
  (`convex/lib/subscriptions.ts`, `convex/payments/core.ts`,
  `convex/notificationJobs.ts`, `convex/crons.ts`, `convex/admin/attention.ts`)

- **2026-11-18 19:29 CAT (UTC+02:00)**: first version. Subscriptions with a
  2-month Pro trial, plan limits enforced on the server, a swappable
  payment provider interface with a development-only mock provider, an
  hourly expiry job, daily payment reconciliation, seller billing pages and
  admin subscriptions/payments pages with grant/extend.
  (`convex/lib/plans.ts`, `convex/lib/subscriptions.ts`,
  `convex/lib/entitlements.ts`, `convex/payments/*`, `convex/billing.ts`,
  `convex/billingJobs.ts`, `convex/crons.ts`, `convex/admin/billing.ts`,
  `convex/http.ts`, `src/features/billing/*`, `src/features/admin/billing/*`)

---

## 1. Overview

> **Source of truth: the admin "Plans & features" page** (`/admin/plans`,
> stored in `planConfig`). The table below is the **seed**
> (`convex/lib/planDefaults.ts`) — what a fresh deployment starts with and
> what "Reset to defaults" restores. Live values may differ.

| Plan | Price / month | Products | Photos / product | Notable features |
|---|---|---|---|---|
| Free | KSh 0 | 10 | 3 | Shop link, WhatsApp orders |
| Pro | KSh 299 | 50 | 6 | Shop stats, all looks, sales and promotions |
| Business | KSh 1,000 | unlimited* | 6 | + team roles, discount codes, order tracking |
| Enterprise | custom ("Talk to us") | unlimited* | 6 | + several shops; **granted by an admin only** |

\* "Unlimited" means up to the platform ceiling `LIMITS.maxProducts` (200),
which every product list depends on. Raising it needs paginated lists.

- Every new shop starts a **Pro trial** (2 months in the seed; the length is
  the trial plan's `trialMonths` in the config), with no payment method needed.
- When a trial or paid period ends, the shop moves to **Free** automatically.
- **Nothing renews automatically**: M-Pesa payments are one-off, so a seller
  pays again to add 30 days.
- All prices are in **KES** minor units (×100), whatever the shop's own
  currency.
- Payments go through one **provider interface**. Today the only provider
  is a **mock** for development; M-Pesa (Daraja) or an aggregator plugs in
  later without changing the rest of the app.

## 2. Where things live

| File | What it holds |
|---|---|
| `convex/lib/plans.ts` | Plan ids, validators, subscription statuses, `TRIAL_PLAN`, `PLAN_CURRENCY`, `PERIOD_DAYS`, `EXPIRY_WARNING_DAYS`, grant rules, `daysLeft`. **No prices or limits** |
| `convex/lib/planFeatures.ts` | The feature catalogue (keys in code: `FEATURES`, `FeatureFlag`), areas, config types, pure rules: `resolvedValue` (inheritance), `resolvePlanLimits`, `applyExceptions`, `loweredFeatures`, `productCap`, `photoCap`, validation (`planSettingsProblem`, `featureValueProblem`, `pricingProblem`) |
| `convex/lib/planConfig.ts` | `readPlanConfig` (stored config merged over the seed), `writePlanConfig` (only writer, version check), `seedPlanConfig`, `activeExceptions` |
| `convex/lib/planDefaults.ts` | **Seed only** (`DEFAULT_PLAN_CONFIG`): fresh deployment, new feature keys, "Reset to defaults" |
| `convex/lib/planCatalog.ts` | `catalogOf` (public view for pricing / plan options), `planNameIn`, `lowestPlanFor` |
| `convex/plans.ts` | Public `catalog` query |
| `convex/admin/plans.ts` | Admin API: `get`, `impact`, `updatePlan`, `setFeatureValue`, `updatePricing`, `resetToDefaults` |
| `convex/admin/planExceptions.ts`, `convex/planExceptionJobs.ts` | Shop exceptions: `listForShop`, `grant`, `revoke`; `expire`, hourly `sweep` |
| `convex/lib/subscriptions.ts` | Pure rules (`trialState`, `applyPurchase`, `expireIfDue`, `grantState`, `extendState`, `effectivePlan`) and the only writer of `subscriptions` (`writeSubscription`, `startTrial`) |
| `convex/lib/entitlements.ts` | "Can this shop do X": `getEntitlements`, `canShopDo`, `requireCan`, `hasFeature`, `visibleProductIds` |
| `convex/payments/types.ts` | Provider ids, payment statuses, outcomes, `ProviderEvent`, `NextAction` validators |
| `convex/payments/provider.ts` | The `PaymentProvider` interface |
| `convex/payments/registry.ts` | Picks the live provider from env vars (`activeProvider`, `mockEnabled`, `providerById`) |
| `convex/payments/mock.ts` | The mock provider and `mockEvent` |
| `convex/payments/core.ts` | `applyEvent` (the only code that applies results), `applyResult`, `startWithProvider`, `markPending`, `markStartFailed`, `reconcilePending`, `refreshStatus` |
| `convex/billing.ts` | Seller API: `mine`, `payments`, `payment`, `startCheckout`, `cancelCheckout`, `mockSimulate` |
| `convex/billingJobs.ts` | `expireDue` (ends trials and paid periods) |
| `convex/crons.ts` | Hourly `expireDue`, daily `reconcilePending` |
| `convex/admin/billing.ts` | Admin API: `subscriptions`, `payments`, `payment`, `forShop`, `grant`, `extend` |
| `convex/http.ts` | Provider webhooks: `POST /payments/callback/<provider>` |
| `convex/migrations.ts` | `billingV1`: a trial for shops created before billing |
| `src/features/billing/` | Seller UI: plan card, plan options and dialogs, payment history, checkout, banner, locked stats card |
| `src/features/admin/billing/` | Admin UI: list columns and URL specs (on the shared `DataTable`), payment drawer, shop plan panel, grant/extend dialog |
| `src/app/(seller)/dashboard/billing/` | `/dashboard/billing` and `/dashboard/billing/checkout/[paymentId]` |
| `src/app/admin/{subscriptions,payments,plans}/` | Admin pages |
| `src/features/admin/plans/` | "Plans & features" page (plan cards, features grid on `DataTable`, feature drawer, impact dialog) and the shop exceptions card |

Marketing pricing (`src/features/marketing/pricing/plans.ts`) holds **no
data**: `buildPlanCards`, `buildComparison` and `startingPriceMinor` derive
everything from `plans.catalog` (server pages via `getPlanCatalog` in
`data.ts`, seller UI via `usePlanCatalog`). Plan names come from the config
(`usePlanName`); in-app "Available on <plan>" notes use the cheapest plan
with the feature (`useUpgradePlanName`).

## 3. Data model (`convex/schema.ts`)

### `subscriptions`: one per shop

| Field | Meaning |
|---|---|
| `shopId`, `shopName` | The shop; `shopName` is a copy for admin search, synced by `shops.update` |
| `plan` | `free \| pro \| business \| enterprise` |
| `status` | `trialing` (trial plan until `periodEnd`), `active` (paid or granted until `periodEnd`), `expired` (a paid plan lapsed → Free limits), `free` (trial ended without payment → Free limits) |
| `periodStart`, `periodEnd` | `periodEnd` is absent on Free |
| `source` | `trial \| payment \| admin \| system` (who set the current state) |

A shop without a row (created before `billingV1` ran) is treated as a trial
counted from its creation date.

### `payments`

| Field | Meaning |
|---|---|
| `shopId`, `shopName` (snapshot), `userId` (payer) | Who paid |
| `plan`, `amountMinor`, `currency` | Always from the plan config's monthly price / `PLAN_CURRENCY`, never from the client |
| `provider`, `providerRef` | Which provider, and its id for this payment |
| `next` | What the buyer does next (`mockCheckout`, `awaitPhoneConfirmation`, `redirect`) |
| `status` | `created` → `pending` → one final state: `succeeded`, `failed`, `cancelled`, `expired` |
| `pendingReportedAt` | The provider said "still processing" |
| `appliedAt`, `periodEndAfter` | Set **in the same transaction** that extended the plan |
| `failureCode`, `completedAt` | Outcome details |

Payments are **kept when a shop is deleted** (financial history); the
subscription row is deleted with the shop.

### `paymentEvents`

Every result received from a provider (`provider`, `eventId`, `paymentId`,
`outcome`, `receivedAt`). The unique `(provider, eventId)` pair is what
makes repeated deliveries harmless.

### `products.pinnedAt`

Set when the seller chose to keep a product visible while the shop is over
its plan's product limit.

## 4. Subscription lifecycle

1. **Trial**: `shops.create` calls `startTrial`, which gives Pro until
   `addMonths(now, trialMonths)` (the trial plan's `trialMonths` in the
   config; changing it affects new shops only). Not logged in the activity history (opening a shop
   isn't a plan change).
2. **Purchase**: a successful payment runs `applyPurchase(current, plan, now, prices)` (monthly prices from the config):
   - same plan, still active: **+30 days** on the current end;
   - during the trial: the plan starts now, and the **remaining trial days
     are kept** (end = trial end + 30 days);
   - another plan, still active: the plan starts now for 30 days, **plus
     unused days converted at the price ratio** (10 Pro days × 299/1000 ≈
     3 Business days; downgrading converts the other way, giving more
     days). A custom-priced plan (Enterprise) converts one for one;
   - free / expired / an already-ended period: the plan starts now for 30 days.
3. **Expiry**: the hourly cron `billingJobs.expireDue` finds `trialing` /
   `active` rows with `periodEnd ≤ now` (index `by_status_and_periodEnd`),
   moving trialing → `free` and active → `expired`. It works in batches
   of 100 and reschedules itself while more are due. Mutations also treat
   a past `periodEnd` as Free right away (`getEntitlements(ctx, shop, now)`),
   so the cron's lag never gives extra days.
4. **Admin grant**: `plan` from now for N days (1–366), with a required
   reason (5–500 characters).
5. **Admin extend**: +N days on the current trial or plan (from now if it
   ended). Refused on Free (`PLAN_INVALID`); grant a plan instead.

Every change except the initial trial is written by `writeSubscription`,
which also records an activity entry and notifies the seller (section 13)
in the same transaction.

## 5. Payment flow

```
Seller picks a plan (/dashboard/billing)
  │  confirm dialog shows the new end date (applyPurchase preview)
  ▼
billing.startCheckout({ plan })                 [seller mutation]
  · provider = activeProvider()  → none? PAYMENTS_UNAVAILABLE
  · reuses an open payment for the same plan; cancels one for another plan
  · plan hidden on the Plans & features page → PLAN_INVALID
  · inserts payment { status: "created", amount = config monthly price }
  · logs payment.started (actor = seller)
  · schedules ↓
payments.core.startWithProvider                 [internal action]
  · provider.start(...) → { providerRef, next }
  · markPending → status "pending", providerRef, next
  │   (start throws → markStartFailed → "failed")
  ▼
Checkout page follows billing.payment live and renders `next`:
  mockCheckout → test buttons | awaitPhoneConfirmation → "confirm on phone" | redirect → link
  ▼
A result arrives as a ProviderEvent, from one of:
  · webhook  POST /payments/callback/<provider> → provider.parseCallback (verifies) → applyResult
  · status poll  refreshStatus → provider.checkStatus → applyResult
  · mock  billing.mockSimulate (server builds the event)
  · seller cancel  billing.cancelCheckout ("cancelled")
  · reconcile  open > 7 days ("expired")
  ▼
payments.core.applyEvent    ← the ONLY place results are applied
```

`applyEvent` outcomes:

| Outcome | Effect | Activity |
|---|---|---|
| `pending` | `pendingReportedAt` set, stays open | `payment.pending` |
| `failed` / `cancelled` / `expired` | final status, plan unchanged | `payment.<outcome>` |
| `succeeded` | `applyPurchase`, subscription written, `appliedAt` + `periodEndAfter` set | `subscription.activated` + `payment.succeeded` |

It returns `applied`, `recorded`, `duplicate`, `ignored` (payment already
final) or `unknown` (no payment with that reference).

**Reconciliation** (daily cron `reconcilePending`): open payments older than
7 days expire through `applyEvent`. Pending payments older than 24 hours get
a `refreshStatus` check with the live provider.

## 6. Duplicate safety and trust

- **The browser never decides an outcome.** The client can only start or
  cancel a checkout. Amounts come from the plan config. Results come from
  the provider, or from the server-built mock event.
- Inside `applyEvent`, all in one serializable Convex transaction:
  1. an event id already seen for this provider → `duplicate`, nothing changes;
  2. only an open payment (`created` / `pending`) can change; final states never change again;
  3. the plan is extended only while `appliedAt` is unset, and `appliedAt`
     is set in the same write.
- Mock event ids are fixed per payment and outcome (`mock_<id>_<outcome>`),
  so double clicks dedupe exactly like a replayed webhook.
- A seller can only read or act on **their own shop's** payments. Anyone
  else's is `NOT_FOUND` / `null`, never "forbidden". A suspended shop can't
  check out (`SHOP_SUSPENDED`).

## 7. Provider interface and adding a real provider

```ts
interface PaymentProvider {
  readonly id: ProviderId
  start(input: StartInput): Promise<StartResult>        // { providerRef, next }
  parseCallback(request: Request): Promise<ProviderEvent | null>  // verify; null = reject (400)
  checkStatus(providerRef: string): Promise<ProviderEvent | null> // null = nothing new
}
```

Checklist to add M-Pesa (Daraja) or an aggregator:

1. Add its id to `PROVIDER_IDS` / `providerIdValidator` in `convex/payments/types.ts`.
2. Create `convex/payments/<name>.ts` implementing `PaymentProvider`:
   - `start`: call the API (e.g. an STK push with the seller's phone) and
     return `next: { kind: "awaitPhoneConfirmation" }` or `{ kind: "redirect", url }`;
   - `parseCallback`: **verify** the request (signature / shared secret /
     allow-list), map it to `{ eventId, providerRef, outcome, failureCode }`;
     `eventId` must be stable across repeated deliveries;
   - `checkStatus`: query the provider for the latest result.
   Code that needs Node built-ins goes in a `"use node"` file.
3. Register it in `PROVIDERS` and `activeProvider()` in `convex/payments/registry.ts`.
4. Put credentials in Convex env vars (`npx convex env set …`), never in code.
5. Point the provider's callback URL at
   `https://<deployment>.convex.site/payments/callback/<id>`.
6. Add tests (verification rejects bad callbacks, dedupe, mapping of outcomes).
7. **Update this document** (change log + the relevant sections).

Nothing else changes: checkout, `applyEvent`, the UI and admin pages
already work with any provider.

## 8. Mock provider (development only)

- Runs only when **both** `PAYMENTS_PROVIDER=mock` **and**
  `PAYMENTS_MOCK_ENABLED=true` are set on the Convex deployment. Unset (the
  default) means payments are off: checkout throws `PAYMENTS_UNAVAILABLE`,
  the billing page shows "Talk to us", and `mockSimulate` refuses.
- **Never set these on production.** They're deployment env vars, not an
  admin setting, so nobody can turn them on from the UI.
- The checkout shows a **Test mode** panel with four buttons:
  - **Simulate success**: the plan is activated (`applyPurchase`).
  - **Simulate failure**: the payment fails and the plan is unchanged.
  - **Simulate pending**: the payment stays pending, and the page shows
    "Payment processing" with **Complete / Fail (test)** controls. The same
    controls appear on pending rows in the payment history.
  - **Cancel**: the payment is cancelled and the plan is unchanged.

## 9. Plan limits and downgrades

All checks go through `convex/lib/entitlements.ts`. `getEntitlements`
reads the live plan config: the effective plan's values (Free once a
period ended), including everything from lower plans (Business always
includes Pro), then the shop's live exceptions on top (a flag turns on, a
limit rises; never lower). The trial counts as Pro. A shop with no
subscription row is on the trial from its creation date.

| Action | Rule | Error |
|---|---|---|
| `addProduct` | count < plan limit (unlimited → platform ceiling, `TOO_MANY_PRODUCTS`) | `PLAN_LIMIT_PRODUCTS` |
| `setPhotos` | count ≤ `photoCap(limits, previousCount)` (a product over the limit keeps its photos, never gains more) | `PLAN_LIMIT_PHOTOS` |
| `pinProduct` | pinned count < plan limit | `PLAN_LIMIT_PRODUCTS` |
| `feature` | flag in `limits.features` (e.g. `shopStats`) | `PLAN_FEATURE_LOCKED` |

- In mutations use `requireCan(ctx, shop, action)`. In queries use
  `hasFeature` / `getEntitlements(ctx, shop)` (stored status; queries don't
  read the clock). In the UI use the pure `canShopDo` with `billing.mine`
  data (the server checks again).
- **Downgrade / expiry never deletes or changes data.** Public visibility
  is computed by `visibleProductIds`: admin-hidden products are excluded,
  then pinned products (most recently pinned first), then the newest, up
  to the limit. The rest are **over the limit**: hidden from `/[slug]`
  (their page is a 404), badged "Over plan limit" in the dashboard, still
  editable. "Show in shop" pins one; pinning beyond the limit is refused.
  Upgrading shows everything again at once.
- Public product pages show only the plan's number of photos; all stay stored.
- Shop looks: a downgraded shop keeps its published look (`shopLooks`)
  but visitors see the free look (`visibleLook` in
  `convex/lib/looks/store.ts`). The "Shop look" page explains this, and
  upgrading brings the design back at once. Publishing a non-free look is
  `PLAN_FEATURE_LOCKED` on Free; drafts still save.
- Event & promo banners: kept (published and draft) after a downgrade, but
  not shown while the plan lacks `salesPromotions`; the editor says so,
  Publish (with a promo) and downloads are disabled. Upgrading shows it
  again at once if its dates are still on.
- Sales: kept after a downgrade (running, scheduled, paused), but not
  shown while the plan lacks `salesPromotions` (normal prices return at
  once). The Sales page shows "Available on Pro"; sales can still be
  paused or deleted, not created, edited, duplicated or resumed.
- Stats are still recorded on Free; `stats.summary` returns
  `{ locked: true }` and the dashboard shows an upgrade card.
- A new paid feature = a key in `FEATURES` (`planFeatures.ts`, `enforced:
  true`) + its seed values in `planDefaults.ts` + EN/FR names
  (`PlanFeatures.<key>`) + a `requireCan({ kind: "feature", feature })`
  call where it's used. Admins then pick its plans on `/admin/plans`.
- Removing a feature from a plan or lowering a limit on `/admin/plans`
  follows the same downgrade rules: nothing is deleted, the feature stops
  working and over-limit products are hidden. The admin sees the number
  of affected shops first.

### Plans & features page (`/admin/plans`, `plans.manage`)

- **Plans**: name (EN / FR), monthly price, yearly price (optional, ≤ 12×
  monthly; the pricing page shows the months saved), trial months (trial
  plan only, 1–12), shown on the pricing page. Free stays at 0; Pro and
  Business need a price above 0 (checkout); Enterprise may have none
  ("Talk to us"). At least one plan stays visible.
- **Features grid** (shared `DataTable`, search + area + "checked by the
  app / pricing page only" filters in the URL): a switch per on/off
  feature, a number (or "Unlimited" where allowed) per limit, per plan.
  Values inherited from a lower plan show "From Pro". A row opens a drawer
  with the same controls and the pricing-page text: table label, card line
  (`{count}` for limits), unlimited / not-included card lines, hint, shown,
  shown on cards, order.
- Features with `enforced: false` are not built or not checked yet:
  switching them only changes the pricing page.
- Every write sends the version it edited (`PLAN_CONFIG_STALE` otherwise),
  is validated again on the server and logged per field
  (`plans.planUpdated`, `plans.featureUpdated`, `plans.pricingUpdated`,
  `plans.reset` with `{ plan, feature, field, from, to }`).
- **Reset to defaults** writes the seed back (after the same impact
  confirmation).

### Shop exceptions

- In the shop drawer (`plans.manage`): give one shop an **enforced**
  feature or a higher limit for 1–366 days, with a reason (5–500
  characters). Never on your own shop. At most 20 live per shop.
- `getEntitlements` applies them first; mutations ignore one past its end
  at once, queries rely on the `active` flag cleared at `endsAt` by
  `planExceptionJobs.expire` (scheduled) and the hourly `sweep`.
- Logged: `planException.granted`, `planException.revoked`,
  `planException.expired` (System).

## 10. Admin and activity history

- Permissions (in `convex/lib/permissions.ts`): `billing.view` (lists, shop
  plan panel), `billing.manage` (grant / extend), and the seller's
  `ownBilling.manage`.
- Grant and extend need a reason, are refused on the admin's own shop
  (`assertNotOwnShop` → `CANNOT_MODIFY_SELF`), and are logged with
  `{ plan, days, reason, previousPlan, previousEnd }`.
- Admin pages: `/admin/subscriptions` (search by shop name; filter by plan,
  status and end date; sort by end date), `/admin/payments` (search; filter
  by plan, status and date; sort by date; a drawer per payment), and a plan
  panel in the shop drawer (`/admin/shops?open=<shopId>`). Filters, page
  and the open row are kept in the URL.
- Activity entries (`/admin/activity`): `subscription.activated`,
  `subscription.trialEnded`, `subscription.expired`, `subscription.grant`,
  `subscription.extend`, `payment.started`, `payment.succeeded`,
  `payment.failed`, `payment.pending`, `payment.cancelled`,
  `payment.expired`. Provider results and jobs are logged as **System**.

## 11. Environment, migration and operations

| Where | Variable | Purpose |
|---|---|---|
| Convex | `PAYMENTS_PROVIDER` | Provider id (`mock` today). Unset = payments off |
| Convex | `PAYMENTS_MOCK_ENABLED` | `true` lets the mock run. **Dev only** |

```bash
# Development: turn on test payments
npx convex env set PAYMENTS_PROVIDER mock
npx convex env set PAYMENTS_MOCK_ENABLED true

# Once per deployment: store the plan config seed (optional; idempotent,
# the app reads the same seed until then; never overwrites admin changes)
npx convex run migrations:plansV1            # add --prod for production
npx convex run migrations:plansV1Status

# Once per deployment that had shops before billing (fresh trial)
npx convex run migrations:billingV1          # add --prod for production
npx convex run migrations:billingV1Status

# Test an ending trial / plan: set a subscription's periodEnd in the past
# (Convex dashboard), then:
npx convex run billingJobs:expireDue
```

Production checklist: run `billingV1 --prod` once; make sure
`PAYMENTS_MOCK_ENABLED` is **not** set; set `PAYMENTS_PROVIDER` only once a
real provider is implemented.

## 12. Testing

| File | Covers |
|---|---|
| `convex/lib/subscriptions.test.ts` | Plan limits ceilings, trial, expiry, `applyPurchase`, `extendState`, the trial on shop creation |
| `convex/lib/planFeatures.test.ts` | Seed = old plans, inheritance, `loweredFeatures`, exceptions, validation |
| `convex/entitlements.test.ts` | `canShopDo`, `visibleProductIds`, product/photo limits, pinning, public pages, locked stats; the central check for Free, Pro, Business, trial, expired, downgrade, live config changes, exceptions |
| `convex/admin/plans.test.ts` | Permission, validation, stale version, audit entries, impact counts, reset |
| `convex/admin/planExceptions.test.ts` | Grant / revoke / expire / sweep, refusals, own shop, audit |
| `convex/plans.test.ts` | Public catalogue: seed, no personal data, follows admin changes |
| `src/features/marketing/pricing/plans.test.ts` | Cards and comparison derived from the catalogue (seed = the old pricing page), hidden plans |
| `convex/billing.test.ts` | Checkout, mock outcomes, dedupe, pending → complete/fail, env guard, ownership, reconcile |
| `convex/billingJobs.test.ts` | Expiry job, `billingV1` migration |
| `convex/admin/billing.test.ts` | Admin lists and filters, grant/extend rules, permissions, shop deletion |

Run `pnpm test` (Node 24, `nvm use`).

## 13. Notifications

Billing uses the central in-app notification service (`notify` in
`convex/lib/notify.ts`, CLAUDE.md "Notifications"). Each one is deduped,
so a retried webhook or job never sends it twice.

| When | Who | Type | Where it's sent from |
|---|---|---|---|
| A plan is activated (payment), granted or extended | shop owner | `plan.activated` | `writeSubscription` |
| A paid plan or the trial ends | shop owner | `plan.expired` (`trial: true/false`) | `writeSubscription` (from `expireDue`) |
| A payment fails (provider result or start failure) | payer | `payment.failed` | `notifyPaymentFailed` in `payments/core.ts` |
| Same | `billing.view` admins (not the payer) | `admin.paymentFailed` | same |
| Trial / plan ends within `EXPIRY_WARNING_DAYS` | shop owner, once per period | `plan.endingSoon` | daily cron `notificationJobs.endingSoon` |
| Same, if any | `billing.view` admins, once a day | `admin.endingSoon` | same |

Cancelled and expired checkouts don't notify (the seller left or the
checkout went stale). The admin dashboard's **Needs attention** cards and
the Payments sidebar badge come from `admin/attention.counts`, which reads
the real tables: failed payments in the last `FAILED_PAYMENT_WINDOW_DAYS`
(7) whose shop hasn't paid successfully since, and trialing / active
subscriptions ending within `EXPIRY_WARNING_DAYS`.
