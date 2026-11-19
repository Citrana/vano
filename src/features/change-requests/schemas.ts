import { z } from "zod"
import type { useTranslations } from "next-intl"
import type { CountryCode } from "libphonenumber-js"
import { LIMITS } from "../../../convex/lib/catalog"
import {
  CHANGE_REASON_MAX,
  CHANGE_REASON_MIN,
  cleanShopName,
  reasonProblem,
  type ProtectedField,
} from "../../../convex/lib/changeRequests"
import { normalizeWhatsapp } from "../../../convex/lib/phone"
import { slugProblem } from "../../../convex/lib/slug"

type TV = ReturnType<typeof useTranslations<"Validation">>

const reason = (tv: TV) =>
  z.string().refine((value) => reasonProblem(value) === null, {
    message: tv("reasonLength", { min: CHANGE_REASON_MIN, max: CHANGE_REASON_MAX }),
  })

/**
 * Client mirror of `changeRequests.create` (same helpers). `newValue` is
 * the name or link; WhatsApp uses `whatsappCountry` + `whatsappNumber`.
 */
export function changeRequestSchema(tv: TV, field: ProtectedField) {
  return z
    .object({
      newValue: z.string(),
      whatsappCountry: z.string(),
      whatsappNumber: z.string(),
      reason: reason(tv),
    })
    .superRefine((values, ctx) => {
      if (field === "name" && cleanShopName(values.newValue) === null) {
        ctx.addIssue({
          code: "custom",
          path: ["newValue"],
          message: tv("nameLength", { min: LIMITS.shopNameMin, max: LIMITS.shopNameMax }),
        })
      }
      if (field === "slug") {
        const problem = slugProblem(values.newValue)
        const message =
          problem === "length" ? tv("slugLength") : problem === "format" ? tv("slugFormat") : problem === "reserved" ? tv("slugReserved") : null
        if (message) ctx.addIssue({ code: "custom", path: ["newValue"], message })
      }
      if (field === "whatsapp" && fullWhatsapp(values) === null) {
        ctx.addIssue({ code: "custom", path: ["whatsappNumber"], message: tv("phoneInvalid") })
      }
    })
}

export type ChangeRequestValues = z.infer<ReturnType<typeof changeRequestSchema>>

/** The WhatsApp number as E.164, or null. */
export function fullWhatsapp(values: { whatsappCountry: string; whatsappNumber: string }): string | null {
  return normalizeWhatsapp(values.whatsappNumber, values.whatsappCountry as CountryCode)
}
