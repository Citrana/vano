import { z } from "zod"
import type { useTranslations } from "next-intl"
import {
  GRANT_DAYS_MAX,
  GRANT_DAYS_MIN,
  GRANT_REASON_MAX,
  GRANT_REASON_MIN,
  grantDaysProblem,
  grantReasonProblem,
} from "../../../../convex/lib/plans"

type TV = ReturnType<typeof useTranslations<"Validation">>

/** Client mirror of `admin.billing.grant` / `extend` (same rules, convex/lib/plans.ts). */
export function grantSchema(tv: TV) {
  return z.object({
    plan: z.enum(["pro", "business", "enterprise"]),
    days: z
      .string()
      .refine((value) => /^\d+$/.test(value.trim()) && grantDaysProblem(Number(value)) === null, {
        message: tv("daysRange", { min: GRANT_DAYS_MIN, max: GRANT_DAYS_MAX }),
      }),
    reason: z.string().refine((value) => grantReasonProblem(value) === null, {
      message: tv("reasonLength", { min: GRANT_REASON_MIN, max: GRANT_REASON_MAX }),
    }),
  })
}

export type GrantFormValues = z.infer<ReturnType<typeof grantSchema>>
