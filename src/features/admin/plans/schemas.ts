import { z } from "zod"
import { minorToInput, parseMoneyToMinor } from "../../../../convex/lib/money"
import {
  planSettingsProblem,
  pricingProblem,
  type FeatureKey,
  type FeaturePricing,
  type Localized,
  type PlanProblem,
  type PlanSettings,
} from "../../../../convex/lib/planFeatures"
import type { PlanId } from "../../../../convex/lib/plans"

/**
 * Client mirrors of `admin.plans.updatePlan` / `updatePricing`: the same
 * rules (`planSettingsProblem`, `pricingProblem` in convex/lib/planFeatures.ts),
 * checked again on the server.
 */

type Message = (problem: PlanProblem | "label" | "order" | "pair") => string

export const planFormSchema = z.object({
  nameEn: z.string(),
  nameFr: z.string(),
  monthly: z.string(),
  yearly: z.string(),
  trialMonths: z.string(),
  visible: z.boolean(),
})
export type PlanFormValues = z.infer<typeof planFormSchema>

export function planFormValues(s: PlanSettings): PlanFormValues {
  return {
    nameEn: s.name.en,
    nameFr: s.name.fr,
    monthly: s.monthlyMinor === null ? "" : minorToInput(s.monthlyMinor),
    yearly: s.yearlyMinor === null ? "" : minorToInput(s.yearlyMinor),
    trialMonths: String(s.trialMonths),
    visible: s.visible,
  }
}

/** Empty = none; text that isn't money = NaN (refused by the rules). */
const money = (text: string): number | null => (text.trim() === "" ? null : (parseMoneyToMinor(text) ?? Number.NaN))

export function toPlanSettings(v: PlanFormValues): PlanSettings {
  return {
    name: { en: v.nameEn.trim(), fr: v.nameFr.trim() },
    monthlyMinor: money(v.monthly),
    yearlyMinor: money(v.yearly),
    trialMonths: /^\d+$/.test(v.trialMonths.trim()) ? Number(v.trialMonths) : Number.NaN,
    visible: v.visible,
  }
}

const PLAN_FIELD: Record<Exclude<PlanProblem, "noVisiblePlan">, keyof PlanFormValues> = {
  name: "nameEn",
  monthlyPrice: "monthly",
  yearlyPrice: "yearly",
  trialMonths: "trialMonths",
}

export function planSchema(plan: PlanId, message: Message) {
  return planFormSchema.superRefine((values, ctx) => {
    const settings = toPlanSettings(values)
    const problem = planSettingsProblem(plan, settings)
    if (problem === null || problem === "noVisiblePlan") return
    // Point at the empty name when one of the two is missing.
    const path = problem === "name" && settings.name.en !== "" && settings.name.fr === "" ? "nameFr" : PLAN_FIELD[problem]
    ctx.addIssue({ code: "custom", path: [path], message: message(problem) })
  })
}

// ---------------------------------------------------------------------------
// Pricing-page text

export const pricingFormSchema = z.object({
  show: z.boolean(),
  showOnCard: z.boolean(),
  order: z.string(),
  labelEn: z.string(),
  labelFr: z.string(),
  cardLabelEn: z.string(),
  cardLabelFr: z.string(),
  unlimitedEn: z.string(),
  unlimitedFr: z.string(),
  offEn: z.string(),
  offFr: z.string(),
  hintEn: z.string(),
  hintFr: z.string(),
})
export type PricingFormValues = z.infer<typeof pricingFormSchema>

export function pricingFormValues(p: FeaturePricing): PricingFormValues {
  return {
    show: p.show,
    showOnCard: p.showOnCard,
    order: String(p.order),
    labelEn: p.label.en,
    labelFr: p.label.fr,
    cardLabelEn: p.cardLabel.en,
    cardLabelFr: p.cardLabel.fr,
    unlimitedEn: p.unlimitedLabel?.en ?? "",
    unlimitedFr: p.unlimitedLabel?.fr ?? "",
    offEn: p.offLabel?.en ?? "",
    offFr: p.offLabel?.fr ?? "",
    hintEn: p.hint?.en ?? "",
    hintFr: p.hint?.fr ?? "",
  }
}

/** Both empty = no text; otherwise both languages are needed. */
const pair = (en: string, fr: string): Localized | undefined =>
  en.trim() === "" && fr.trim() === "" ? undefined : { en: en.trim(), fr: fr.trim() }

export function toPricing(v: PricingFormValues): FeaturePricing {
  const out: FeaturePricing = {
    show: v.show,
    showOnCard: v.showOnCard,
    order: /^\d+$/.test(v.order.trim()) ? Number(v.order) : Number.NaN,
    label: { en: v.labelEn.trim(), fr: v.labelFr.trim() },
    cardLabel: { en: v.cardLabelEn.trim(), fr: v.cardLabelFr.trim() },
  }
  const unlimitedLabel = pair(v.unlimitedEn, v.unlimitedFr)
  const offLabel = pair(v.offEn, v.offFr)
  const hint = pair(v.hintEn, v.hintFr)
  if (unlimitedLabel) out.unlimitedLabel = unlimitedLabel
  if (offLabel) out.offLabel = offLabel
  if (hint) out.hint = hint
  return out
}

const TEXT_PAIRS: readonly [keyof PricingFormValues, keyof PricingFormValues, boolean][] = [
  ["labelEn", "labelFr", true],
  ["cardLabelEn", "cardLabelFr", true],
  ["unlimitedEn", "unlimitedFr", false],
  ["offEn", "offFr", false],
  ["hintEn", "hintFr", false],
]

export function pricingSchema(feature: FeatureKey, message: Message) {
  return pricingFormSchema.superRefine((values, ctx) => {
    // A text needs both languages (required ones can't be empty).
    for (const [en, fr, required] of TEXT_PAIRS) {
      const a = (values[en] as string).trim()
      const b = (values[fr] as string).trim()
      if (required || a !== "" || b !== "") {
        if (a === "") ctx.addIssue({ code: "custom", path: [en], message: message("pair") })
        if (b === "") ctx.addIssue({ code: "custom", path: [fr], message: message("pair") })
      }
    }
    const problem = pricingProblem(feature, toPricing(values))
    if (problem === "order") ctx.addIssue({ code: "custom", path: ["order"], message: message("order") })
    else if (problem === "label") ctx.addIssue({ code: "custom", path: ["labelEn"], message: message("label") })
  })
}

// ---------------------------------------------------------------------------
// Shop exceptions (mirror of `admin.planExceptions.grant`)

export const exceptionFormSchema = z.object({
  feature: z.string(),
  limit: z.string(),
  unlimited: z.boolean(),
  days: z.string(),
  reason: z.string(),
})
export type ExceptionFormValues = z.infer<typeof exceptionFormSchema>
