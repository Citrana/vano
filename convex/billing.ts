import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { getEntitlements, shopProducts, visibleProductIds } from "./lib/entitlements";
import { fail } from "./lib/errors";
import { currencyValidator } from "./lib/money";
import { readPlanConfig } from "./lib/planConfig";
import { limitsValidator, toLimitsResult } from "./lib/planValidators";
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
    currency: p.currency,
    status: p.status,
    provider: p.provider,
    pendingReportedAt: p.pendingReportedAt ?? null,
    completedAt: p.completedAt ?? null,
    periodEndAfter: p.periodEndAfter ?? null,
  };
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
    /** The resolved limits (plan config + exceptions), for `canShopDo` in the UI. */
    limits: limitsValidator,
    usage: v.object({ products: v.number(), overLimit: v.number(), pinned: v.number() }),
    payments: v.object({ available: v.boolean(), testMode: v.boolean() }),
    openPaymentId: v.union(v.id("payments"), v.null()),
  }),
  handler: async (ctx) => {
    const shop = await requireOwnShop(ctx);
    const { plan, status, limits, state } = await getEntitlements(ctx, shop);
    const products = await shopProducts(ctx, shop._id);
    const visible = visibleProductIds(products, limits);
    const listed = products.filter((p) => !p.hidden);
    const open = await openPayments(ctx, shop._id);
    return {
      plan: state.plan,
      effectivePlan: plan,
      status,
      periodStart: state.periodStart,
      periodEnd: state.periodEnd,
      limits: toLimitsResult(limits),
      usage: {
        products: products.length,
        overLimit: listed.filter((p) => !visible.has(p._id)).length,
        pinned: listed.filter((p) => p.pinnedAt !== undefined).length,
      },
      payments: { available: activeProvider() !== null, testMode: mockEnabled() },
      openPaymentId: open[0]?._id ?? null,
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
 * admin "Plans & features" page); a plan hidden there can't be bought. An
 * open checkout for the same plan is reused; one for another plan is
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
    const { plans } = await readPlanConfig(ctx);
    const amountMinor = plans[plan].monthlyMinor;
    if (!plans[plan].visible || amountMinor === null || amountMinor <= 0) fail("PLAN_INVALID");

    for (const open of await openPayments(ctx, shop._id)) {
      if (open.plan === plan && open.provider === provider.id) return open._id;
      await cancelOpenPayment(ctx, open);
    }

    const paymentId = await ctx.db.insert("payments", {
      shopId: shop._id,
      shopName: shop.name,
      userId: ctx.user._id,
      plan,
      amountMinor,
      currency: PLAN_CURRENCY,
      provider: provider.id,
      status: "created",
    });
    await logPayment(ctx, (await ctx.db.get("payments", paymentId))!, "payment.started", ctx.user);
    await ctx.scheduler.runAfter(0, internal.payments.core.startWithProvider, { paymentId });
    return paymentId;
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
