import { z } from "zod"
import type { useTranslations } from "next-intl"
import { CATEGORY_KEYS, type Category } from "../../../convex/lib/catalog"
import { CODE_MAX, CODE_MIN, codeTextProblem, normalizeCode } from "../../../convex/lib/discountCodes/code"
import { codeScheduleProblem, MAX_USES_LIMIT, maxUsesProblem } from "../../../convex/lib/discountCodes/rules"
import type { CodeDiscount } from "../../../convex/lib/discountCodes/validators"
import { minorToInput } from "../../../convex/lib/money"
import { PERCENT_MAX, PERCENT_MIN } from "../../../convex/lib/sales/discount"
import type { SaleTarget } from "../../../convex/lib/sales/validators"
import { toDiscount, toTarget } from "@/features/sales/schemas"

type TC = ReturnType<typeof useTranslations<"DiscountCodes.form">>
type TS = ReturnType<typeof useTranslations<"Sales.form">>

/**
 * Client mirror of `discountCodes.create` / `update`: the same pure rules
 * (convex/lib/discountCodes, convex/lib/sales) and the sale form's
 * discount / target helpers. The server checks again.
 */
export function codeSchema(t: TC, ts: TS, now: () => number, uses: number) {
  return z
    .object({
      code: z.string().refine((c) => codeTextProblem(normalizeCode(c)) === null, t("codeInvalid", { min: CODE_MIN, max: CODE_MAX })),
      discountKind: z.enum(["percent", "amount"]),
      discountValue: z.string(),
      targetMode: z.enum(["product", "products", "category", "shop"]),
      productIds: z.array(z.string()),
      category: z.union([z.enum(CATEGORY_KEYS), z.literal("")]),
      excludedIds: z.array(z.string()),
      startsAt: z.number().optional(),
      endsAt: z.number().optional(),
      limitUses: z.boolean(),
      maxUses: z.string(),
    })
    .superRefine((values, ctx) => {
      if (toDiscount(values) === null) {
        ctx.addIssue({
          code: "custom",
          path: ["discountValue"],
          message: values.discountKind === "percent" ? ts("percentRange", { min: PERCENT_MIN, max: PERCENT_MAX }) : ts("amountInvalid"),
        })
      }
      if ((values.targetMode === "product" || values.targetMode === "products") && values.productIds.length === 0) {
        ctx.addIssue({ code: "custom", path: ["productIds"], message: ts("chooseProducts") })
      }
      if (values.targetMode === "category" && values.category === "") {
        ctx.addIssue({ code: "custom", path: ["category"], message: ts("chooseCategory") })
      }
      if (values.endsAt === undefined || codeScheduleProblem({ startsAt: values.startsAt, endsAt: values.endsAt }, now()) !== null) {
        ctx.addIssue({ code: "custom", path: ["endsAt"], message: ts("scheduleInvalid") })
      }
      if (values.limitUses) {
        const problem = maxUsesProblem(toMaxUses(values) ?? Number.NaN, uses)
        if (problem) {
          ctx.addIssue({
            code: "custom",
            path: ["maxUses"],
            message: problem === "belowUses" ? t("maxUsesBelow", { uses }) : t("maxUsesRange", { max: MAX_USES_LIMIT }),
          })
        }
      }
    })
}

export type CodeFormValues = z.infer<ReturnType<typeof codeSchema>>

/** The maximum the form describes; undefined = no limit. */
export function toMaxUses(values: Pick<CodeFormValues, "limitUses" | "maxUses">): number | undefined {
  if (!values.limitUses) return undefined
  const text = values.maxUses.trim()
  return /^\d{1,7}$/.test(text) ? Number(text) : Number.NaN
}

export function toCodeDiscount(values: Pick<CodeFormValues, "discountKind" | "discountValue">): CodeDiscount | null {
  return toDiscount(values) as CodeDiscount | null
}

export { toTarget }

/** A saved code (or nothing) → form values. */
export function codeInitialValues(code: {
  code: string
  discount: CodeDiscount
  target: SaleTarget
  startsAt: number
  endsAt: number
  maxUses: number | null
} | null): CodeFormValues {
  if (!code) {
    return {
      code: "",
      discountKind: "percent",
      discountValue: "",
      targetMode: "shop",
      productIds: [],
      category: "",
      excludedIds: [],
      startsAt: undefined,
      endsAt: undefined,
      limitUses: false,
      maxUses: "",
    }
  }
  const t = code.target
  return {
    code: code.code,
    discountKind: code.discount.kind,
    discountValue: code.discount.kind === "percent" ? String(code.discount.value) : minorToInput(code.discount.value),
    targetMode: t.kind === "products" ? (t.productIds.length === 1 ? "product" : "products") : t.kind,
    productIds: t.kind === "products" ? t.productIds : [],
    category: t.kind === "category" ? t.category : ("" as Category | ""),
    excludedIds: t.kind === "products" ? [] : t.excludedIds,
    startsAt: code.startsAt,
    endsAt: code.endsAt,
    limitUses: code.maxUses !== null,
    maxUses: code.maxUses === null ? "" : String(code.maxUses),
  }
}
