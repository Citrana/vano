import { z } from "zod"
import type { useTranslations } from "next-intl"
import { DECISION_REASON_MAX, DECISION_REASON_MIN, reasonProblem } from "../../../../convex/lib/changeRequests"

type TV = ReturnType<typeof useTranslations<"Validation">>

/** Client mirror of `admin.changeRequests.reject`: a reason the seller will read. */
export function rejectSchema(tv: TV) {
  return z.object({
    reason: z.string().refine((value) => reasonProblem(value, DECISION_REASON_MIN, DECISION_REASON_MAX) === null, {
      message: tv("reasonLength", { min: DECISION_REASON_MIN, max: DECISION_REASON_MAX }),
    }),
  })
}

export type RejectValues = z.infer<ReturnType<typeof rejectSchema>>
