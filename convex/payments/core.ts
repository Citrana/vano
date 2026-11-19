import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "../_generated/server";
import { logAdminAction, type AuditAction } from "../lib/audit";
import { minorToInput } from "../lib/money";
import { notify } from "../lib/notify";
import { DAY_MS, isPaidPlan } from "../lib/plans";
import { applyPurchase, subscriptionOf, writeSubscription } from "../lib/subscriptions";
import { activeProvider, providerById } from "./registry";
import {
  isOpenPayment,
  nextActionValidator,
  providerEventValidator,
  providerIdValidator,
  type PaymentOutcome,
  type ProviderEvent,
  type ProviderId,
} from "./types";

/**
 * The payment engine (CLAUDE.md "Billing"). Provider results (webhooks,
 * status polls, the mock's simulated results) all end in `applyEvent`,
 * the only code that changes a payment's outcome or extends a plan.
 *
 * Duplicate safety, all inside one transaction:
 * 1. an event id already seen for this provider is ignored;
 * 2. only an open payment (created / pending) can change — final states
 *    never change again;
 * 3. the plan is extended only while `appliedAt` is unset, and
 *    `appliedAt` is set in the same write.
 */

export type ApplyResult = "applied" | "recorded" | "duplicate" | "ignored" | "unknown";
const applyResultValidator = v.union(
  v.literal("applied"),
  v.literal("recorded"),
  v.literal("duplicate"),
  v.literal("ignored"),
  v.literal("unknown"),
);

export function amountLabel(payment: Pick<Doc<"payments">, "amountMinor" | "currency">): string {
  return `${minorToInput(payment.amountMinor)} ${payment.currency}`;
}

/** Records a payment event in the activity history ("system" unless an actor is given). */
export async function logPayment(
  ctx: MutationCtx,
  payment: Doc<"payments">,
  action: AuditAction,
  actor: Doc<"users"> | null = null,
): Promise<void> {
  await logAdminAction(ctx, {
    actor,
    action,
    targetType: "payment",
    targetId: payment._id,
    targetLabel: payment.shopName,
    details: {
      plan: payment.plan,
      amount: amountLabel(payment),
      provider: payment.provider,
      reference: payment.providerRef ?? null,
    },
  });
}

/**
 * A failed payment reaches the seller who paid and billing admins (not the
 * payer again if they're an admin too). Deduped per payment.
 */
export async function notifyPaymentFailed(ctx: MutationCtx, payment: Doc<"payments">): Promise<void> {
  const dedupeKey = `pay.failed:${payment._id}`;
  await notify(ctx, {
    data: { type: "payment.failed", paymentId: payment._id, plan: payment.plan },
    to: { userId: payment.userId },
    dedupeKey,
  });
  await notify(ctx, {
    data: {
      type: "admin.paymentFailed",
      paymentId: payment._id,
      shopId: payment.shopId,
      shopName: payment.shopName,
      plan: payment.plan,
      amount: amountLabel(payment),
    },
    to: { permission: "billing.view" },
    dedupeKey,
    exclude: [payment.userId],
  });
}

const FINAL_ACTIONS: Record<Exclude<PaymentOutcome, "pending" | "succeeded">, AuditAction> = {
  failed: "payment.failed",
  cancelled: "payment.cancelled",
  expired: "payment.expired",
};

/** Applies one provider result. See the file comment for the guarantees. */
export async function applyEvent(
  ctx: MutationCtx,
  provider: ProviderId,
  event: ProviderEvent,
): Promise<ApplyResult> {
  const seen = await ctx.db
    .query("paymentEvents")
    .withIndex("by_provider_and_eventId", (q) => q.eq("provider", provider).eq("eventId", event.eventId))
    .unique();
  if (seen) return "duplicate";

  const payment = await ctx.db
    .query("payments")
    .withIndex("by_provider_and_providerRef", (q) =>
      q.eq("provider", provider).eq("providerRef", event.providerRef),
    )
    .unique();
  if (!payment) return "unknown";

  const now = Date.now();
  await ctx.db.insert("paymentEvents", {
    provider,
    eventId: event.eventId,
    paymentId: payment._id,
    outcome: event.outcome,
    receivedAt: now,
  });
  if (!isOpenPayment(payment.status)) return "ignored";

  if (event.outcome === "pending") {
    await ctx.db.patch("payments", payment._id, { status: "pending", pendingReportedAt: now });
    await logPayment(ctx, payment, "payment.pending");
    return "recorded";
  }

  if (event.outcome !== "succeeded") {
    await ctx.db.patch("payments", payment._id, {
      status: event.outcome,
      failureCode: event.failureCode,
      completedAt: now,
    });
    await logPayment(ctx, payment, FINAL_ACTIONS[event.outcome]);
    if (event.outcome === "failed") await notifyPaymentFailed(ctx, payment);
    return "recorded";
  }

  // Succeeded. `appliedAt` is unset here because the payment is still open,
  // but it's checked again so the guarantee doesn't depend on that.
  const shop = await ctx.db.get("shops", payment.shopId);
  if (payment.appliedAt !== undefined || !shop || !isPaidPlan(payment.plan)) {
    await ctx.db.patch("payments", payment._id, { status: "succeeded", completedAt: now });
    await logPayment(ctx, payment, "payment.succeeded");
    return "recorded";
  }
  const current = await subscriptionOf(ctx, shop);
  const next = applyPurchase(current, payment.plan, now);
  await writeSubscription(ctx, shop, next, {
    source: "payment",
    action: "subscription.activated",
    actor: null,
    details: { previousPlan: current.plan, amount: amountLabel(payment) },
  });
  await ctx.db.patch("payments", payment._id, {
    status: "succeeded",
    completedAt: now,
    appliedAt: now,
    periodEndAfter: next.periodEnd ?? undefined,
  });
  await logPayment(ctx, payment, "payment.succeeded");
  return "applied";
}

/** Entry point for verified webhooks and status polls. */
export const applyResult = internalMutation({
  args: { provider: providerIdValidator, event: providerEventValidator },
  returns: applyResultValidator,
  handler: async (ctx, { provider, event }) => await applyEvent(ctx, provider, event),
});

// ---------------------------------------------------------------------------
// Starting a payment

export const paymentForStart = internalQuery({
  args: { paymentId: v.id("payments") },
  returns: v.union(
    v.null(),
    v.object({
      status: v.string(),
      provider: providerIdValidator,
      amountMinor: v.number(),
      currency: v.string(),
      plan: v.string(),
    }),
  ),
  handler: async (ctx, { paymentId }) => {
    const p = await ctx.db.get("payments", paymentId);
    return p
      ? { status: p.status, provider: p.provider, amountMinor: p.amountMinor, currency: p.currency, plan: p.plan }
      : null;
  },
});

/** Scheduled by `billing.startCheckout`: hands the payment to the provider. */
export const startWithProvider = internalAction({
  args: { paymentId: v.id("payments") },
  returns: v.null(),
  handler: async (ctx, { paymentId }) => {
    const payment = await ctx.runQuery(internal.payments.core.paymentForStart, { paymentId });
    if (!payment || payment.status !== "created") return null;
    const provider = providerById(payment.provider);
    if (!provider) {
      await ctx.runMutation(internal.payments.core.markStartFailed, { paymentId, failureCode: "provider_unavailable" });
      return null;
    }
    try {
      const result = await provider.start({
        paymentId,
        amountMinor: payment.amountMinor,
        currency: "KES",
        description: `Vano ${payment.plan}`,
      });
      await ctx.runMutation(internal.payments.core.markPending, {
        paymentId,
        providerRef: result.providerRef,
        next: result.next,
      });
    } catch {
      await ctx.runMutation(internal.payments.core.markStartFailed, { paymentId, failureCode: "start_failed" });
    }
    return null;
  },
});

export const markPending = internalMutation({
  args: { paymentId: v.id("payments"), providerRef: v.string(), next: nextActionValidator },
  returns: v.null(),
  handler: async (ctx, { paymentId, providerRef, next }) => {
    const payment = await ctx.db.get("payments", paymentId);
    if (!payment || payment.status !== "created") return null;
    await ctx.db.patch("payments", paymentId, { status: "pending", providerRef, next });
    return null;
  },
});

export const markStartFailed = internalMutation({
  args: { paymentId: v.id("payments"), failureCode: v.string() },
  returns: v.null(),
  handler: async (ctx, { paymentId, failureCode }) => {
    const payment = await ctx.db.get("payments", paymentId);
    if (!payment || payment.status !== "created") return null;
    await ctx.db.patch("payments", paymentId, { status: "failed", failureCode, completedAt: Date.now() });
    await logPayment(ctx, payment, "payment.failed");
    await notifyPaymentFailed(ctx, payment);
    return null;
  },
});

// ---------------------------------------------------------------------------
// Reconciliation (daily cron)

const STALE_AFTER_MS = DAY_MS;
const EXPIRE_AFTER_MS = 7 * DAY_MS;
const RECONCILE_BATCH = 100;

/**
 * Open payments older than 7 days expire (through `applyEvent`, so it's
 * deduplicated like any result). Pending ones older than a day get a
 * status check with the live provider.
 */
export const reconcilePending = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    for (const status of ["created", "pending"] as const) {
      const old = await ctx.db
        .query("payments")
        .withIndex("by_status", (q) => q.eq("status", status).lt("_creationTime", now - EXPIRE_AFTER_MS))
        .take(RECONCILE_BATCH);
      for (const payment of old) {
        if (payment.providerRef) {
          await applyEvent(ctx, payment.provider, {
            eventId: `expire_${payment._id}`,
            providerRef: payment.providerRef,
            outcome: "expired",
          });
        } else {
          await ctx.db.patch("payments", payment._id, { status: "expired", completedAt: now });
          await logPayment(ctx, payment, "payment.expired");
        }
      }
    }
    const stale = await ctx.db
      .query("payments")
      .withIndex("by_status", (q) => q.eq("status", "pending").lt("_creationTime", now - STALE_AFTER_MS))
      .take(RECONCILE_BATCH);
    if (activeProvider() !== null) {
      for (const payment of stale) {
        await ctx.scheduler.runAfter(0, internal.payments.core.refreshStatus, { paymentId: payment._id });
      }
    }
    return null;
  },
});

export const paymentRef = internalQuery({
  args: { paymentId: v.id("payments") },
  returns: v.union(v.null(), v.object({ provider: providerIdValidator, providerRef: v.string() })),
  handler: async (ctx, { paymentId }) => {
    const p = await ctx.db.get("payments", paymentId);
    return p?.providerRef && isOpenPayment(p.status) ? { provider: p.provider, providerRef: p.providerRef } : null;
  },
});

/** Asks the provider for a payment's latest result and applies it. */
export const refreshStatus = internalAction({
  args: { paymentId: v.id("payments") },
  returns: v.null(),
  handler: async (ctx, { paymentId }) => {
    const ref: { provider: ProviderId; providerRef: string } | null = await ctx.runQuery(
      internal.payments.core.paymentRef,
      { paymentId },
    );
    if (!ref) return null;
    const provider = providerById(ref.provider);
    const event = provider ? await provider.checkStatus(ref.providerRef) : null;
    if (event) await ctx.runMutation(internal.payments.core.applyResult, { provider: ref.provider, event });
    return null;
  },
});
