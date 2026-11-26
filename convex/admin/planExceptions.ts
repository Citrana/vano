import { v } from "convex/values";
import { internal } from "../_generated/api";
import { adminMutation, adminQuery } from "../lib/access";
import { logAdminAction } from "../lib/audit";
import { utcDay } from "../lib/days";
import { getEntitlements } from "../lib/entitlements";
import { fail } from "../lib/errors";
import { assertNotOwnShop } from "../lib/guards";
import { MAX_SHOP_EXCEPTIONS, readPlanConfig } from "../lib/planConfig";
import {
  featureValueProblem,
  isExceptionFeature,
  isFeatureKey,
  isLower,
  resolvePlanLimits,
  valueLabel,
  type FeatureKey,
  type FeatureValue,
  type PlanLimits,
} from "../lib/planFeatures";
import { exceptionEndValidator, featureValueValidator } from "../lib/planValidators";
import { DAY_MS, GRANT_DAYS_MAX, grantReasonProblem } from "../lib/plans";

/**
 * Shop exceptions (CLAUDE.md "Billing"): one shop gets a feature or a
 * higher limit until a date, with a reason (a partner, a support case).
 * The central check (`getEntitlements`) applies them on top of the plan.
 * They end by themselves at `endsAt` (`planExceptionJobs.expire`) or when
 * revoked. Same permission as the Plans & features page; never on your
 * own shop; every grant, revoke and expiry is in the activity history.
 */

const PERMISSION = "plans.manage" as const;

const row = v.object({
  _id: v.id("planExceptions"),
  createdAt: v.number(),
  feature: v.string(),
  value: featureValueValidator,
  endsAt: v.number(),
  reason: v.string(),
  active: v.boolean(),
  createdByEmail: v.string(),
  endedAt: v.union(v.number(), v.null()),
  endedReason: v.union(exceptionEndValidator, v.null()),
});

/** The shop's exceptions: live ones first, then the most recent ended ones. */
export const listForShop = adminQuery({
  permission: PERMISSION,
  args: { shopId: v.id("shops") },
  returns: v.array(row),
  handler: async (ctx, { shopId }) => {
    const live = await ctx.db
      .query("planExceptions")
      .withIndex("by_shopId_and_active", (q) => q.eq("shopId", shopId).eq("active", true))
      .take(MAX_SHOP_EXCEPTIONS);
    const ended = await ctx.db
      .query("planExceptions")
      .withIndex("by_shopId_and_active", (q) => q.eq("shopId", shopId).eq("active", false))
      .order("desc")
      .take(10);
    const out = [];
    for (const e of [...live, ...ended]) {
      const by = await ctx.db.get("users", e.createdBy);
      out.push({
        _id: e._id,
        createdAt: e._creationTime,
        feature: e.feature,
        value: e.value,
        endsAt: e.endsAt,
        reason: e.reason,
        active: e.active,
        createdByEmail: by?.email ?? "",
        endedAt: e.endedAt ?? null,
        endedReason: e.endedReason ?? null,
      });
    }
    return out;
  },
});

/** The plan's own value for a feature (before exceptions). */
function planValue(limits: PlanLimits, key: FeatureKey): FeatureValue {
  if (key === "products") return limits.products;
  if (key === "photosPerProduct") return limits.photosPerProduct;
  if (key === "teamMembers") return limits.teamMembers;
  return (limits.features as readonly string[]).includes(key);
}

/** Gives the shop a feature (value true) or a higher limit until `endsAt`. */
export const grant = adminMutation({
  permission: PERMISSION,
  args: {
    shopId: v.id("shops"),
    feature: v.string(),
    value: featureValueValidator,
    endsAt: v.number(),
    reason: v.string(),
  },
  returns: v.id("planExceptions"),
  handler: async (ctx, { shopId, feature, value, endsAt, reason }) => {
    if (!isFeatureKey(feature) || !isExceptionFeature(feature)) fail("EXCEPTION_INVALID");
    if (featureValueProblem(feature, value) !== null || value === false) fail("EXCEPTION_INVALID");
    if (grantReasonProblem(reason) !== null) fail("REASON_INVALID");
    const now = Date.now();
    if (!Number.isFinite(endsAt) || endsAt <= now || endsAt > now + GRANT_DAYS_MAX * DAY_MS) fail("DAYS_INVALID");

    const shop = await ctx.db.get("shops", shopId);
    if (!shop) fail("NOT_FOUND");
    await assertNotOwnShop(ctx, ctx.access, shop);

    // It must give more than the plan already does (else it's pointless).
    const { plan } = await getEntitlements(ctx, shop, now);
    const planLimits = resolvePlanLimits(await readPlanConfig(ctx), plan);
    if (!isLower(value, planValue(planLimits, feature))) fail("EXCEPTION_INVALID");

    const live = await ctx.db
      .query("planExceptions")
      .withIndex("by_shopId_and_active", (q) => q.eq("shopId", shopId).eq("active", true))
      .take(MAX_SHOP_EXCEPTIONS);
    if (live.length >= MAX_SHOP_EXCEPTIONS) fail("EXCEPTION_INVALID");

    const cleanReason = reason.trim();
    const id = await ctx.db.insert("planExceptions", {
      shopId,
      feature,
      value,
      endsAt,
      reason: cleanReason,
      createdBy: ctx.user._id,
      active: true,
    });
    await ctx.scheduler.runAt(endsAt, internal.planExceptionJobs.expire, { exceptionId: id });
    await logAdminAction(ctx, {
      actor: ctx.user,
      action: "planException.granted",
      targetType: "shop",
      targetId: shop._id,
      targetLabel: shop.name,
      details: { feature, value: valueLabel(value), plan, endsAt: utcDay(endsAt), reason: cleanReason },
    });
    return id;
  },
});

/** Ends a live exception now. */
export const revoke = adminMutation({
  permission: PERMISSION,
  args: { exceptionId: v.id("planExceptions") },
  returns: v.null(),
  handler: async (ctx, { exceptionId }) => {
    const exception = await ctx.db.get("planExceptions", exceptionId);
    if (!exception || !exception.active) fail("NOT_FOUND");
    const shop = await ctx.db.get("shops", exception.shopId);
    if (shop) await assertNotOwnShop(ctx, ctx.access, shop);
    await ctx.db.patch("planExceptions", exception._id, {
      active: false,
      endedAt: Date.now(),
      endedBy: ctx.user._id,
      endedReason: "revoked",
    });
    await logAdminAction(ctx, {
      actor: ctx.user,
      action: "planException.revoked",
      targetType: "shop",
      targetId: exception.shopId,
      targetLabel: shop?.name ?? "",
      details: { feature: exception.feature, value: valueLabel(exception.value) },
    });
    return null;
  },
});
