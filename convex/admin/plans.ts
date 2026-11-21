import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { adminMutation, adminQuery, type AdminMutationCtx } from "../lib/access";
import { logAdminAction, type AuditDetails } from "../lib/audit";
import { fail } from "../lib/errors";
import { readPlanConfig, writePlanConfig } from "../lib/planConfig";
import { DEFAULT_PLAN_CONFIG } from "../lib/planDefaults";
import {
  featureDef,
  featureValueProblem,
  isFeatureKey,
  loweredFeatures,
  planSettingsProblem,
  pricingProblem,
  trimLocalized,
  valueLabel,
  withFeatureValue,
  type FeatureKey,
  type FeaturePricing,
  type Localized,
  type PlanConfigData,
  type PlanSettings,
} from "../lib/planFeatures";
import {
  featurePricingValidator,
  featureSettingsValidator,
  featureValueValidator,
  planSettingsValidator,
  plansValidator,
} from "../lib/planValidators";
import { planIdValidator, type PlanId } from "../lib/plans";

/**
 * Admin "Plans & features" (CLAUDE.md "Billing"): plan names, prices,
 * trial and visibility; which plan gets which feature and the limits; the
 * pricing-page text. Every write sends the `expectedVersion` it edited
 * (PLAN_CONFIG_STALE when someone saved in between), is validated again
 * here and is logged with the old and new value. Data is never touched:
 * a removed feature or lower limit only changes what the checks allow.
 */

const PERMISSION = "plans.manage" as const;

/** Impact counts stop here ("5 000+"), so the preview stays cheap. */
export const IMPACT_CAP = 5000;

export const get = adminQuery({
  permission: PERMISSION,
  args: {},
  returns: v.object({
    version: v.number(),
    updatedAt: v.union(v.number(), v.null()),
    plans: plansValidator,
    features: v.record(v.string(), featureSettingsValidator),
  }),
  handler: async (ctx) => {
    const config = await readPlanConfig(ctx);
    return { version: config.version, updatedAt: config.updatedAt, plans: config.plans, features: config.features };
  },
});

// ---------------------------------------------------------------------------
// Impact preview

const changeValidator = v.union(
  v.object({ kind: v.literal("value"), feature: v.string(), plan: planIdValidator, value: featureValueValidator }),
  v.object({ kind: v.literal("reset") }),
);

/** Shops whose effective plan is one of `plans` (capped). */
async function countShopsOn(ctx: QueryCtx, plans: readonly PlanId[]): Promise<{ shops: number; capped: boolean }> {
  let shops = 0;
  const left = () => IMPACT_CAP + 1 - shops;
  for (const plan of plans) {
    if (left() <= 0) break;
    if (plan === "free") {
      for (const status of ["free", "expired"] as const) {
        if (left() <= 0) break;
        const rows = await ctx.db
          .query("subscriptions")
          .withIndex("by_status_and_periodEnd", (q) => q.eq("status", status))
          .take(left());
        shops += rows.length;
      }
      continue;
    }
    for (const status of ["trialing", "active"] as const) {
      if (left() <= 0) break;
      const rows = await ctx.db
        .query("subscriptions")
        .withIndex("by_plan_and_status_and_periodEnd", (q) => q.eq("plan", plan).eq("status", status))
        .take(left());
      shops += rows.length;
    }
  }
  return { shops: Math.min(shops, IMPACT_CAP), capped: shops > IMPACT_CAP };
}

/**
 * What a change would take away, before saving: the (feature, plan) pairs
 * that get less, and how many shops are on those plans now (enforced
 * features only; the others change the pricing page only).
 */
export const impact = adminQuery({
  permission: PERMISSION,
  args: { change: changeValidator },
  returns: v.object({
    lowered: v.array(v.object({ feature: v.string(), plan: planIdValidator, enforced: v.boolean() })),
    shops: v.number(),
    capped: v.boolean(),
  }),
  handler: async (ctx, { change }) => {
    const current = await readPlanConfig(ctx);
    let next: PlanConfigData;
    if (change.kind === "reset") next = DEFAULT_PLAN_CONFIG;
    else {
      if (!isFeatureKey(change.feature) || featureValueProblem(change.feature, change.value) !== null) {
        fail("PLAN_CONFIG_INVALID");
      }
      next = withFeatureValue(current, change.feature, change.plan, change.value);
    }
    const lowered = loweredFeatures(current, next).map((l) => ({
      ...l,
      enforced: featureDef(l.feature).enforced,
    }));
    const plans = [...new Set(lowered.filter((l) => l.enforced).map((l) => l.plan))];
    const { shops, capped } = await countShopsOn(ctx, plans);
    return { lowered, shops, capped };
  },
});

// ---------------------------------------------------------------------------
// Writes

/** Flat scalar view of an object for field-by-field audit entries. */
type Flat = Record<string, string | number | boolean | null>;

function flatLocalized(prefix: string, text: Localized | undefined): Flat {
  return { [`${prefix}.en`]: text?.en ?? null, [`${prefix}.fr`]: text?.fr ?? null };
}

function flatPlan(s: PlanSettings): Flat {
  return {
    ...flatLocalized("name", s.name),
    monthlyMinor: s.monthlyMinor,
    yearlyMinor: s.yearlyMinor,
    trialMonths: s.trialMonths,
    visible: s.visible,
  };
}

function flatPricing(p: FeaturePricing): Flat {
  return {
    show: p.show,
    showOnCard: p.showOnCard,
    order: p.order,
    ...flatLocalized("label", p.label),
    ...flatLocalized("cardLabel", p.cardLabel),
    ...flatLocalized("unlimitedLabel", p.unlimitedLabel),
    ...flatLocalized("offLabel", p.offLabel),
    ...flatLocalized("hint", p.hint),
  };
}

function changedFields(before: Flat, after: Flat): { field: string; from: Flat[string]; to: Flat[string] }[] {
  return Object.keys(after).flatMap((field) =>
    before[field] === after[field] ? [] : [{ field, from: before[field] ?? null, to: after[field] }],
  );
}

async function logChanges(
  ctx: AdminMutationCtx,
  action: "plans.planUpdated" | "plans.pricingUpdated",
  target: { id: string; label: string },
  base: AuditDetails,
  changes: ReturnType<typeof changedFields>,
): Promise<void> {
  for (const c of changes) {
    await logAdminAction(ctx, {
      actor: ctx.user,
      action,
      targetType: "planConfig",
      targetId: target.id,
      targetLabel: target.label,
      details: { ...base, field: c.field, from: c.from, to: c.to },
    });
  }
}

const optionalLocalized = (text: Localized | undefined) =>
  text === undefined ? undefined : trimLocalized(text);

/** Name, prices, trial length and visibility of one plan. */
export const updatePlan = adminMutation({
  permission: PERMISSION,
  args: { expectedVersion: v.number(), plan: planIdValidator, settings: planSettingsValidator },
  returns: v.number(),
  handler: async (ctx, { expectedVersion, plan, settings }) => {
    const clean: PlanSettings = { ...settings, name: trimLocalized(settings.name) };
    if (planSettingsProblem(plan, clean) !== null) fail("PLAN_CONFIG_INVALID");
    const current = await readPlanConfig(ctx);
    if (current.version !== expectedVersion) fail("PLAN_CONFIG_STALE");
    const changes = changedFields(flatPlan(current.plans[plan]), flatPlan(clean));
    if (changes.length === 0) return current.version;
    const version = await writePlanConfig(
      ctx,
      { ...current, plans: { ...current.plans, [plan]: clean } },
      expectedVersion,
      ctx.user._id,
    );
    await logChanges(ctx, "plans.planUpdated", { id: plan, label: clean.name.en }, { plan }, changes);
    return version;
  },
});

function requireFeature(key: string): FeatureKey {
  if (!isFeatureKey(key)) fail("PLAN_CONFIG_INVALID");
  return key;
}

/** Switches a feature on / off for a plan, or sets its limit (null = unlimited). */
export const setFeatureValue = adminMutation({
  permission: PERMISSION,
  args: { expectedVersion: v.number(), feature: v.string(), plan: planIdValidator, value: featureValueValidator },
  returns: v.number(),
  handler: async (ctx, { expectedVersion, feature, plan, value }) => {
    const key = requireFeature(feature);
    if (featureValueProblem(key, value) !== null) fail("PLAN_CONFIG_INVALID");
    const current = await readPlanConfig(ctx);
    if (current.version !== expectedVersion) fail("PLAN_CONFIG_STALE");
    const before = current.features[key].values[plan];
    if (before === value) return current.version;
    const version = await writePlanConfig(ctx, withFeatureValue(current, key, plan, value), expectedVersion, ctx.user._id);
    await logAdminAction(ctx, {
      actor: ctx.user,
      action: "plans.featureUpdated",
      targetType: "planConfig",
      targetId: key,
      targetLabel: key,
      details: { feature: key, plan, from: valueLabel(before), to: valueLabel(value) },
    });
    return version;
  },
});

/** The pricing-page text, visibility and order of one feature. */
export const updatePricing = adminMutation({
  permission: PERMISSION,
  args: { expectedVersion: v.number(), feature: v.string(), pricing: featurePricingValidator },
  returns: v.number(),
  handler: async (ctx, { expectedVersion, feature, pricing }) => {
    const key = requireFeature(feature);
    const clean: FeaturePricing = {
      ...pricing,
      label: trimLocalized(pricing.label),
      cardLabel: trimLocalized(pricing.cardLabel),
      unlimitedLabel: optionalLocalized(pricing.unlimitedLabel),
      offLabel: optionalLocalized(pricing.offLabel),
      hint: optionalLocalized(pricing.hint),
    };
    // Optional texts left out are dropped, not stored as undefined fields.
    for (const k of ["unlimitedLabel", "offLabel", "hint"] as const) if (clean[k] === undefined) delete clean[k];
    if (pricingProblem(key, clean) !== null) fail("PLAN_CONFIG_INVALID");
    const current = await readPlanConfig(ctx);
    if (current.version !== expectedVersion) fail("PLAN_CONFIG_STALE");
    const changes = changedFields(flatPricing(current.features[key].pricing), flatPricing(clean));
    if (changes.length === 0) return current.version;
    const next: PlanConfigData = {
      ...current,
      features: { ...current.features, [key]: { ...current.features[key], pricing: clean } },
    };
    const version = await writePlanConfig(ctx, next, expectedVersion, ctx.user._id);
    await logChanges(ctx, "plans.pricingUpdated", { id: key, label: key }, { feature: key }, changes);
    return version;
  },
});

/** Puts the whole configuration back to the seed (`planDefaults.ts`). */
export const resetToDefaults = adminMutation({
  permission: PERMISSION,
  args: { expectedVersion: v.number() },
  returns: v.number(),
  handler: async (ctx, { expectedVersion }) => {
    const current = await readPlanConfig(ctx);
    const lowered = loweredFeatures(current, DEFAULT_PLAN_CONFIG).length;
    const version = await writePlanConfig(ctx, DEFAULT_PLAN_CONFIG, expectedVersion, ctx.user._id);
    await logAdminAction(ctx, {
      actor: ctx.user,
      action: "plans.reset",
      targetType: "planConfig",
      targetId: "all",
      targetLabel: "Plans & features",
      details: { fromVersion: current.version, toVersion: version, lowered },
    });
    return version;
  },
});
