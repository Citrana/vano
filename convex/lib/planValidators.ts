import { v, type Infer } from "convex/values";
import type { PlanLimits } from "./planFeatures";

/** Validators of the plan configuration (`planConfig` table, admin args). */

const localized = v.object({ en: v.string(), fr: v.string() });
export const localizedValidator = localized;
export const featureValueValidator = v.union(v.boolean(), v.number(), v.null());

export const planSettingsValidator = v.object({
  name: localized,
  monthlyMinor: v.union(v.number(), v.null()),
  yearlyMinor: v.union(v.number(), v.null()),
  trialMonths: v.number(),
  visible: v.boolean(),
});

export const featurePricingValidator = v.object({
  show: v.boolean(),
  showOnCard: v.boolean(),
  order: v.number(),
  label: localized,
  cardLabel: localized,
  unlimitedLabel: v.optional(localized),
  offLabel: v.optional(localized),
  hint: v.optional(localized),
});

export const planValuesValidator = v.object({
  free: featureValueValidator,
  pro: featureValueValidator,
  business: featureValueValidator,
  enterprise: featureValueValidator,
});
export const plansValidator = v.object({
  free: planSettingsValidator,
  pro: planSettingsValidator,
  business: planSettingsValidator,
  enterprise: planSettingsValidator,
});
export const featureSettingsValidator = v.object({
  values: planValuesValidator,
  pricing: featurePricingValidator,
});

/** The `planConfig` table's fields. */
export const planConfigFields = {
  /** Bumped on every write; admins send the version they edited. */
  version: v.number(),
  updatedAt: v.number(),
  updatedBy: v.optional(v.id("users")),
  plans: plansValidator,
  /** Keyed by feature key; unknown keys are ignored, missing ones seeded. */
  features: v.record(v.string(), featureSettingsValidator),
};

/** Why a shop exception stopped. */
export const exceptionEndValidator = v.union(v.literal("expired"), v.literal("revoked"));
export type ExceptionEnd = Infer<typeof exceptionEndValidator>;

/** Resolved limits sent to the UI (`PlanLimits`; features as plain keys). */
export const limitsValidator = v.object({
  products: v.union(v.number(), v.null()),
  photosPerProduct: v.number(),
  teamMembers: v.number(),
  features: v.array(v.string()),
});

export function toLimitsResult(limits: PlanLimits): Infer<typeof limitsValidator> {
  return {
    products: limits.products,
    photosPerProduct: limits.photosPerProduct,
    teamMembers: limits.teamMembers,
    features: [...limits.features],
  };
}

const planIdLiteral = v.union(v.literal("free"), v.literal("pro"), v.literal("business"), v.literal("enterprise"));

/** `plans.catalog` (see convex/lib/planCatalog.ts). */
export const catalogValidator = v.object({
  currency: v.union(v.literal("USD"), v.literal("CDF"), v.literal("KES"), v.literal("EUR")),
  trialPlan: planIdLiteral,
  trialMonths: v.number(),
  plans: v.array(
    v.object({
      id: planIdLiteral,
      name: localized,
      monthlyMinor: v.union(v.number(), v.null()),
      yearlyMinor: v.union(v.number(), v.null()),
      visible: v.boolean(),
    }),
  ),
  features: v.array(
    v.object({
      key: v.string(),
      kind: v.union(v.literal("flag"), v.literal("limit")),
      area: v.string(),
      enforced: v.boolean(),
      values: planValuesValidator,
      pricing: featurePricingValidator,
    }),
  ),
});
