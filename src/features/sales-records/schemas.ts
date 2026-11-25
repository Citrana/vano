import { z } from "zod"
import type { useTranslations } from "next-intl"
import { parseMoneyToMinor } from "../../../convex/lib/money"
import {
  cleanCustomerPhone,
  cleanOption,
  customerNameProblem,
  finalPriceProblem,
  quantityProblem,
  soldAtProblem,
} from "../../../convex/lib/salesRecords/rules"
import { SALE_SOURCES } from "../../../convex/lib/salesRecords/validators"
import { fromLocalInput } from "@/lib/local-time"

/** The wall clock, read when a form validates (never during render). */
export const clock = (): number => Date.now()

type TV = ReturnType<typeof useTranslations<"SalesRecords.validation">>

/** The price text as minor units, or null while it isn't a valid price. */
export function priceOf(text: string): number | null {
  const minor = parseMoneyToMinor(text)
  return minor !== null && finalPriceProblem(minor) === null ? minor : null
}

/**
 * Client mirror of `salesRecords.record` (same pure rules from
 * convex/lib/salesRecords). The price stays text and is converted with
 * `parseMoneyToMinor`; the date is "YYYY-MM-DDTHH:mm" in the shop's zone.
 */
export function recordSchema(
  tv: TV,
  ctx: { sizes: readonly string[]; colors: readonly string[]; country: string; timeZone: string; now: () => number },
) {
  return z
    .object({
      size: z.string(),
      color: z.string(),
      quantity: z.number(),
      price: z.string(),
      source: z.enum(SALE_SOURCES),
      customerName: z.string(),
      customerPhone: z.string(),
      soldAt: z.string(),
      markSoldOut: z.boolean(),
    })
    .superRefine((v, issue) => {
      if (!cleanOption(v.size, ctx.sizes).ok) issue.addIssue({ code: "custom", path: ["size"], message: tv("option") })
      if (!cleanOption(v.color, ctx.colors).ok) issue.addIssue({ code: "custom", path: ["color"], message: tv("option") })
      if (quantityProblem(v.quantity) !== null) issue.addIssue({ code: "custom", path: ["quantity"], message: tv("quantity") })
      if (priceOf(v.price) === null) issue.addIssue({ code: "custom", path: ["price"], message: tv("price") })
      if (customerNameProblem(v.customerName) !== null) issue.addIssue({ code: "custom", path: ["customerName"], message: tv("name") })
      if (cleanCustomerPhone(v.customerPhone, ctx.country) === null) {
        issue.addIssue({ code: "custom", path: ["customerPhone"], message: tv("phone") })
      }
      const soldAt = fromLocalInput(v.soldAt, ctx.timeZone)
      if (soldAt === undefined || soldAtProblem(soldAt, ctx.now()) !== null) {
        issue.addIssue({ code: "custom", path: ["soldAt"], message: tv("date") })
      }
    })
}

export type RecordFormValues = z.infer<ReturnType<typeof recordSchema>>

/** The edit dialog: price, quantity and date only. */
export function editSchema(tv: TV, ctx: { timeZone: string; now: () => number }) {
  return z
    .object({ price: z.string(), quantity: z.number(), soldAt: z.string() })
    .superRefine((v, issue) => {
      if (quantityProblem(v.quantity) !== null) issue.addIssue({ code: "custom", path: ["quantity"], message: tv("quantity") })
      if (priceOf(v.price) === null) issue.addIssue({ code: "custom", path: ["price"], message: tv("price") })
      const soldAt = fromLocalInput(v.soldAt, ctx.timeZone)
      if (soldAt === undefined || soldAtProblem(soldAt, ctx.now()) !== null) {
        issue.addIssue({ code: "custom", path: ["soldAt"], message: tv("date") })
      }
    })
}

export type EditFormValues = z.infer<ReturnType<typeof editSchema>>
