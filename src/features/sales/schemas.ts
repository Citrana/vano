import { z } from "zod"
import type { useTranslations } from "next-intl"
import type { Id } from "../../../convex/_generated/dataModel"
import { CATEGORY_KEYS, type Category } from "../../../convex/lib/catalog"
import { minorToInput, parseMoneyToMinor } from "../../../convex/lib/money"
import { discountProblem, PERCENT_MAX, PERCENT_MIN } from "../../../convex/lib/sales/discount"
import { SALE_NAME_MAX, SALE_NAME_MIN, saleNameProblem, saleScheduleProblem } from "../../../convex/lib/sales/rules"
import type { SaleDiscount, SaleDisplay, SaleTarget } from "../../../convex/lib/sales/validators"

type TS = ReturnType<typeof useTranslations<"Sales.form">>

/** "product" and "products" are both a list of chosen products on the server. */
export type TargetMode = "product" | "products" | "category" | "shop"

/**
 * Client mirror of `sales.create` / `update` (same pure rules from
 * convex/lib/sales). Amounts stay text in the form and are converted with
 * `parseMoneyToMinor` (CLAUDE.md "Money").
 */
export function saleSchema(ts: TS, now: () => number) {
  return z
    .object({
      name: z.string().refine((n) => saleNameProblem(n) === null, ts("nameLength", { min: SALE_NAME_MIN, max: SALE_NAME_MAX })),
      discountKind: z.enum(["percent", "amount", "price"]),
      discountValue: z.string(),
      targetMode: z.enum(["product", "products", "category", "shop"]),
      productIds: z.array(z.string()),
      category: z.union([z.enum(CATEGORY_KEYS), z.literal("")]),
      excludedIds: z.array(z.string()),
      startsAt: z.number().optional(),
      endsAt: z.number().optional(),
      display: z.object({ countdown: z.boolean(), badge: z.boolean(), label: z.boolean() }),
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
      if (values.endsAt === undefined || saleScheduleProblem({ startsAt: values.startsAt, endsAt: values.endsAt }, now()) !== null) {
        ctx.addIssue({ code: "custom", path: ["endsAt"], message: ts("scheduleInvalid") })
      }
    })
}

export type SaleFormValues = z.infer<ReturnType<typeof saleSchema>>

/** The discount the form describes, or null while it's invalid. */
export function toDiscount(values: Pick<SaleFormValues, "discountKind" | "discountValue">): SaleDiscount | null {
  const text = values.discountValue.trim()
  const value = values.discountKind === "percent" ? (/^\d{1,3}$/.test(text) ? Number(text) : null) : parseMoneyToMinor(text)
  if (value === null) return null
  const discount = { kind: values.discountKind, value }
  return discountProblem(discount) === null ? discount : null
}

export function toTarget(values: Pick<SaleFormValues, "targetMode" | "productIds" | "category" | "excludedIds">): SaleTarget | null {
  switch (values.targetMode) {
    case "product":
      return values.productIds.length > 0 ? { kind: "products", productIds: [values.productIds[0] as Id<"products">] } : null
    case "products":
      return values.productIds.length > 0 ? { kind: "products", productIds: values.productIds as Id<"products">[] } : null
    case "category":
      return values.category === ""
        ? null
        : { kind: "category", category: values.category, excludedIds: values.excludedIds as Id<"products">[] }
    case "shop":
      return { kind: "shop", excludedIds: values.excludedIds as Id<"products">[] }
  }
}

/** A saved sale (or nothing) → form values. */
export function initialValues(sale: {
  name: string
  discount: SaleDiscount
  target: SaleTarget
  startsAt: number
  endsAt: number
  display: SaleDisplay
} | null): SaleFormValues {
  if (!sale) {
    return {
      name: "",
      discountKind: "percent",
      discountValue: "",
      targetMode: "products",
      productIds: [],
      category: "",
      excludedIds: [],
      startsAt: undefined,
      endsAt: undefined,
      display: { countdown: true, badge: true, label: false },
    }
  }
  const t = sale.target
  return {
    name: sale.name,
    discountKind: sale.discount.kind,
    discountValue: sale.discount.kind === "percent" ? String(sale.discount.value) : minorToInput(sale.discount.value),
    targetMode: t.kind === "products" ? (t.productIds.length === 1 ? "product" : "products") : t.kind,
    productIds: t.kind === "products" ? t.productIds : [],
    category: t.kind === "category" ? t.category : ("" as Category | ""),
    excludedIds: t.kind === "products" ? [] : t.excludedIds,
    startsAt: sale.startsAt,
    endsAt: sale.endsAt,
    display: sale.display,
  }
}
