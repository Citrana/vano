import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { sendDowngradeEmail } from "./emails/planEmails";
import { logAdminAction } from "./lib/audit";
import { getEntitlements, hiddenFromShop, shopProducts, visibleProductIds } from "./lib/entitlements";
import { fail } from "./lib/errors";
import { shopDowngradeImpact } from "./lib/shopDowngrade";
import { currencyValidator } from "./lib/money";
import { readPlanConfig } from "./lib/planConfig";
import { limitsValidator, toLimitsResult } from "./lib/planValidators";
import { isPendingChange } from "./lib/planEmails";
import {
  dayOrNull,
  graceEndOf,
  planChangeKind,
  pricesOf,
  quotePurchase,
  stateAt,
  subscriptionOf,
  type SubscriptionState,
} from "./lib/subscriptions";
import {
  PLAN_CURRENCY,
  paidPlanValidator,
  planIdValidator,
  subscriptionStatusValidator,
} from "./lib/plans";
import { requireOwnShop, sellerMutation, sellerQuery, type SellerMutationCtx } from "./lib/seller";
import { applyEvent, logPayment } from "./payments/core";
import { mockEvent } from "./payments/mock";
import { activeProvider, mockEnabled } from "./payments/registry";
import {
  isOpenPayment,
  nextActionValidator,
  paymentStatusValidator,
  providerIdValidator,
} from "./payments/types";

/**
 * The seller's billing (CLAUDE.md "Billing"): their own shop's plan,
 * checkout and payment history — never another shop's. Results are never
 * accepted from the browser: checkout only starts a payment; the outcome
 * comes from the provider (or, in development, `mockSimulate`, which
 * builds the provider event on the server).
 */

const PERMISSION = "ownBilling.manage" as const;

const paymentRow = v.object({
  _id: v.id("payments"),
  createdAt: v.number(),
  plan: planIdValidator,
  amountMinor: v.number(),
  creditMinor: v.number(),
  currency: currencyValidator,
  status: paymentStatusValidator,
  provider: providerIdValidator,
  pendingReportedAt: v.union(v.number(), v.null()),
  completedAt: v.union(v.number(), v.null()),
  periodEndAfter: v.union(v.number(), v.null()),
});

function toRow(p: Doc<"payments">) {
  return {
    _id: p._id,
    createdAt: p._creationTime,
    plan: p.plan,
    amountMinor: p.amountMinor,
    creditMinor: p.creditMinor ?? 0,
    currency: p.currency,
    status: p.status,
    provider: p.provider,
    pendingReportedAt: p.pendingReportedAt ?? null,
    completedAt: p.completedAt ?? null,
    periodEndAfter: p.periodEndAfter ?? null,
  };
}

/** The shop's chosen lower plan while it still applies (`isPendingChange`: same plan end, plan still running). */
async function pendingChange(
  ctx: QueryCtx,
  shopId: Id<"shops">,
  state: SubscriptionState,
): Promise<Doc<"planChanges"> | null> {
  const rows = await ctx.db
    .query("planChanges")
    .withIndex("by_shopId_and_status", (q) => q.eq("shopId", shopId).eq("status", "scheduled"))
    .order("desc")
    .take(5);
  return rows.find((row) => isPendingChange(row, state)) ?? null;
}

async function openPayments(ctx: QueryCtx, shopId: Id<"shops">): Promise<Doc<"payments">[]> {
  const out: Doc<"payments">[] = [];
  for (const status of ["created", "pending"] as const) {
    out.push(
      ...(await ctx.db
        .query("payments")
        .withIndex("by_shopId_and_status", (q) => q.eq("shopId", shopId).eq("status", status))
        .take(10)),
    );
  }
  return out;
}

/** Plan, status, dates, limits and usage for the billing page and banners. */
export const mine = sellerQuery({
  permission: PERMISSION,
  args: {},
  returns: v.object({
    plan: planIdValidator,
    /** The plan whose limits apply (Free once the period has ended). */
    effectivePlan: planIdValidator,
    status: subscriptionStatusValidator,
    periodStart: v.number(),
    periodEnd: v.union(v.number(), v.null()),
    /** The paid days inside the period (for the upgrade credit preview). */
    paidStart: v.union(v.number(), v.null()),
    paidEnd: v.union(v.number(), v.null()),
    /** The resolved limits (plan config + exceptions), for `canShopDo` in the UI. */
    limits: limitsValidator,
    usage: v.object({ products: v.number(), overLimit: v.number(), pinned: v.number() }),
    payments: v.object({ available: v.boolean(), testMode: v.boolean() }),
    openPaymentId: v.union(v.id("payments"), v.null()),
    /** A lower plan the seller chose, still waiting for the current plan's end ("Keep my plan"). */
    pendingChange: v.union(
      v.null(),
      v.object({ _id: v.id("planChanges"), toPlan: planIdValidator, effectiveAt: v.number() }),
    ),
  }),
  handler: async (ctx) => {
    const shop = await requireOwnShop(ctx);
    const { plan, status, limits, state } = await getEntitlements(ctx, shop);
    const change = await pendingChange(ctx, shop._id, state);
    const products = await shopProducts(ctx, shop._id);
    const visible = visibleProductIds(products, limits);
    const listed = products.filter((p) => !hiddenFromShop(p));
    const open = await openPayments(ctx, shop._id);
    return {
      plan: state.plan,
      effectivePlan: plan,
      status,
      periodStart: state.periodStart,
      periodEnd: state.periodEnd,
      paidStart: state.paidStart ?? null,
      paidEnd: state.paidEnd ?? null,
      limits: toLimitsResult(limits),
      usage: {
        products: products.length,
        overLimit: listed.filter((p) => !visible.has(p._id)).length,
        pinned: listed.filter((p) => p.pinnedAt !== undefined).length,
      },
      payments: { available: activeProvider() !== null, testMode: mockEnabled() },
      openPaymentId: open[0]?._id ?? null,
      pendingChange: change ? { _id: change._id, toPlan: change.toPlan, effectiveAt: change.effectiveAt } : null,
    };
  },
});

/**
 * The current shop's resolved limits and product usage, for every team
 * member (`canShopDo` locks in the UI); plan dates and payments stay in
 * `mine`, which only the owner reads (CLAUDE.md "Team accounts").
 */
export const shopLimits = sellerQuery({
  permission: "ownShop.view",
  args: {},
  returns: v.object({
    effectivePlan: planIdValidator,
    limits: limitsValidator,
    usage: v.object({ products: v.number(), overLimit: v.number(), pinned: v.number() }),
  }),
  handler: async (ctx) => {
    const shop = await requireOwnShop(ctx);
    const { plan, limits } = await getEntitlements(ctx, shop);
    const products = await shopProducts(ctx, shop._id);
    const visible = visibleProductIds(products, limits);
    const listed = products.filter((p) => !hiddenFromShop(p));
    return {
      effectivePlan: plan,
      limits: toLimitsResult(limits),
      usage: {
        products: products.length,
        overLimit: listed.filter((p) => !visible.has(p._id)).length,
        pinned: listed.filter((p) => p.pinnedAt !== undefined).length,
      },
    };
  },
});

/** The caller's payment history, newest first. */
export const payments = sellerQuery({
  permission: PERMISSION,
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(paymentRow),
  handler: async (ctx, { paginationOpts }) => {
    const shop = await requireOwnShop(ctx);
    const result = await ctx.db
      .query("payments")
      .withIndex("by_shopId", (q) => q.eq("shopId", shop._id))
      .order("desc")
      .paginate(paginationOpts);
    return { ...result, page: result.page.map(toRow) };
  },
});

/**
 * One of the caller's payments for the checkout page. A plain string id so
 * a mistyped URL returns null; someone else's payment is null too.
 */
export const payment = sellerQuery({
  permission: PERMISSION,
  args: { paymentId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      ...paymentRow.fields,
      next: v.union(nextActionValidator, v.null()),
      testMode: v.boolean(),
    }),
  ),
  handler: async (ctx, { paymentId }) => {
    const shop = await requireOwnShop(ctx);
    const id = ctx.db.normalizeId("payments", paymentId);
    const p = id ? await ctx.db.get("payments", id) : null;
    if (!p || p.shopId !== shop._id) return null;
    return { ...toRow(p), next: p.next ?? null, testMode: mockEnabled() };
  },
});

/**
 * Starts paying for a plan. The amount comes from the plan config (the
 * admin "Plans & features" page) and `quotePurchase`: full price, minus
 * the credit for paid days left when moving up from a paid plan. A hidden
 * plan can't be bought, and a downgrade is never charged (the current plan
 * just runs to its end). An open checkout for the same plan and amount is
 * reused; any other (another plan, or a credit that has changed since) is
 * cancelled first, so a shop has at most one open payment.
 */
export const startCheckout = sellerMutation({
  permission: PERMISSION,
  args: { plan: paidPlanValidator },
  returns: v.id("payments"),
  handler: async (ctx, { plan }) => {
    const shop = await requireOwnShop(ctx);
    const provider = activeProvider();
    if (provider === null) fail("PAYMENTS_UNAVAILABLE");
    const config = await readPlanConfig(ctx);
    const price = config.plans[plan].monthlyMinor;
    if (!config.plans[plan].visible || price === null || price <= 0) fail("PLAN_INVALID");
    const quote = quotePurchase(await subscriptionOf(ctx, shop, config), plan, Date.now(), pricesOf(config));
    if (quote.kind === "downgrade" || quote.amountMinor <= 0) fail("PLAN_INVALID");

    for (const open of await openPayments(ctx, shop._id)) {
      if (open.plan === plan && open.provider === provider.id && open.amountMinor === quote.amountMinor) return open._id;
      await cancelOpenPayment(ctx, open);
    }

    const paymentId = await ctx.db.insert("payments", {
      shopId: shop._id,
      shopName: shop.name,
      userId: ctx.user._id,
      plan,
      amountMinor: quote.amountMinor,
      creditMinor: quote.creditMinor > 0 ? quote.creditMinor : undefined,
      currency: PLAN_CURRENCY,
      provider: provider.id,
      status: "created",
    });
    await logPayment(ctx, (await ctx.db.get("payments", paymentId))!, "payment.started", ctx.user);
    await ctx.scheduler.runAfter(0, internal.payments.core.startWithProvider, { paymentId });
    return paymentId;
  },
});

/**
 * What would pause if the caller's shop moved to `plan` (the downgrade
 * dialog): running sales, live discount codes, products over the new
 * limit and the look parts the plan doesn't include, from the shop's real
 * data. Nothing is deleted by a downgrade; this only explains it.
 */
export const downgradeImpact = sellerQuery({
  permission: PERMISSION,
  args: { plan: planIdValidator },
  returns: v.object({
    sales: v.number(),
    discountCodes: v.number(),
    productsHidden: v.number(),
    look: v.boolean(),
    sections: v.boolean(),
    eventBanner: v.boolean(),
    promoBar: v.boolean(),
  }),
  handler: async (ctx, { plan }) => {
    const shop = await requireOwnShop(ctx);
    return (await shopDowngradeImpact(ctx, shop, plan)).impact;
  },
});

async function requireOwnPayment(ctx: SellerMutationCtx, paymentId: Id<"payments">) {
  const shop = await requireOwnShop(ctx);
  const payment = await ctx.db.get("payments", paymentId);
  if (!payment || payment.shopId !== shop._id) fail("NOT_FOUND");
  return payment;
}

async function cancelOpenPayment(ctx: SellerMutationCtx, payment: Doc<"payments">): Promise<void> {
  if (payment.providerRef) {
    await applyEvent(ctx, payment.provider, {
      eventId: `cancel_${payment._id}`,
      providerRef: payment.providerRef,
      outcome: "cancelled",
    });
  } else {
    await ctx.db.patch("payments", payment._id, { status: "cancelled", completedAt: Date.now() });
    await logPayment(ctx, payment, "payment.cancelled", ctx.user);
  }
}

/** The seller backs out of checkout. Nothing about the plan changes. */
export const cancelCheckout = sellerMutation({
  permission: PERMISSION,
  args: { paymentId: v.id("payments") },
  returns: v.null(),
  handler: async (ctx, { paymentId }) => {
    const payment = await requireOwnPayment(ctx, paymentId);
    if (!isOpenPayment(payment.status)) fail("PAYMENT_NOT_OPEN");
    await cancelOpenPayment(ctx, payment);
    return null;
  },
});

/**
 * Development only: plays the mock provider's part. Refused unless the
 * mock is enabled on this deployment (PAYMENTS_UNAVAILABLE). The event is
 * built here on the server, with a fixed id per payment and outcome, and
 * goes through the same `applyEvent` as real provider results — so a
 * double click or replay is applied once.
 */
export const mockSimulate = sellerMutation({
  permission: PERMISSION,
  args: {
    paymentId: v.id("payments"),
    outcome: v.union(v.literal("succeeded"), v.literal("failed"), v.literal("pending")),
  },
  returns: v.union(
    v.literal("applied"),
    v.literal("recorded"),
    v.literal("duplicate"),
    v.literal("ignored"),
    v.literal("unknown"),
  ),
  handler: async (ctx, { paymentId, outcome }) => {
    if (!mockEnabled()) fail("PAYMENTS_UNAVAILABLE");
    const payment = await requireOwnPayment(ctx, paymentId);
    if (payment.provider !== "mock") fail("PAYMENTS_UNAVAILABLE");
    // Still being handed to the provider: nothing to simulate yet.
    if (!payment.providerRef) fail("PAYMENT_NOT_OPEN");
    return await applyEvent(ctx, "mock", mockEvent(payment._id, outcome));
  },
});

/**
 * The seller chooses a lower plan or Free (the downgrade dialog). Nothing
 * is charged and nothing changes now: the current plan runs to its end and
 * nothing renews by itself. The choice is recorded (`planChanges`) so the
 * billing page can show it with "Keep my plan", and the owner gets one
 * confirmation email per change (docs/payments.md section 15). Choosing the
 * same plan again returns the same change (no second email); another lower
 * plan replaces it.
 */
export const scheduleDowngrade = sellerMutation({
  permission: PERMISSION,
  args: { plan: planIdValidator },
  returns: v.id("planChanges"),
  handler: async (ctx, { plan }) => {
    const shop = await requireOwnShop(ctx);
    const now = Date.now();
    const state = stateAt(await subscriptionOf(ctx, shop), now);
    const freeAt = graceEndOf(state);
    if (planChangeKind(state, plan, now) !== "downgrade" || state.periodEnd === null || freeAt === null) {
      fail("PLAN_INVALID");
    }

    const current = await pendingChange(ctx, shop._id, state);
    if (current?.toPlan === plan) return current._id;
    if (current) await ctx.db.patch("planChanges", current._id, { status: "replaced" });

    const changeId = await ctx.db.insert("planChanges", {
      shopId: shop._id,
      userId: ctx.user._id,
      fromPlan: state.plan,
      toPlan: plan,
      effectiveAt: state.periodEnd,
      freeAt,
      status: "scheduled",
    });
    await logAdminAction(ctx, {
      actor: ctx.user,
      action: "subscription.downgradeScheduled",
      targetType: "subscription",
      targetId: shop._id,
      targetLabel: shop.name,
      details: { plan: state.plan, toPlan: plan, periodEnd: dayOrNull(state.periodEnd) },
    });
    await sendDowngradeEmail(ctx, { change: (await ctx.db.get("planChanges", changeId))!, shop, now });
    return changeId;
  },
});

/**
 * "Keep my plan" (billing page, the confirmation email's button): cancels
 * the chosen lower plan. Another shop's change, or one that no longer
 * applies, is NOT_FOUND.
 */
export const keepPlan = sellerMutation({
  permission: PERMISSION,
  args: { changeId: v.id("planChanges") },
  returns: v.null(),
  handler: async (ctx, { changeId }) => {
    const shop = await requireOwnShop(ctx);
    const now = Date.now();
    const change = await ctx.db.get("planChanges", changeId);
    if (!change || change.shopId !== shop._id) fail("NOT_FOUND");
    if (!isPendingChange(change, stateAt(await subscriptionOf(ctx, shop), now))) fail("NOT_FOUND");
    await ctx.db.patch("planChanges", changeId, { status: "kept", keptAt: now });
    await logAdminAction(ctx, {
      actor: ctx.user,
      action: "subscription.downgradeKept",
      targetType: "subscription",
      targetId: shop._id,
      targetLabel: shop.name,
      details: { plan: change.fromPlan, toPlan: change.toPlan },
    });
    return null;
  },
});
