import { z } from "zod"
import type { useTranslations } from "next-intl"
import type { CountryCode } from "libphonenumber-js"
import { CATEGORY_KEYS, LANGUAGES, LIMITS } from "../../../convex/lib/catalog"
import { CURRENCIES } from "../../../convex/lib/money"
import { normalizeWhatsapp } from "../../../convex/lib/phone"
import { slugProblem } from "../../../convex/lib/slug"

type TV = ReturnType<typeof useTranslations<"Validation">>

/** Client mirror of `shops.create` / `shops.update` rules (same helpers). */
export function shopSchema(tv: TV) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(LIMITS.shopNameMin, tv("nameLength", { min: LIMITS.shopNameMin, max: LIMITS.shopNameMax }))
        .max(LIMITS.shopNameMax, tv("nameLength", { min: LIMITS.shopNameMin, max: LIMITS.shopNameMax })),
      slug: z.string().superRefine((slug, ctx) => {
        const problem = slugProblem(slug)
        if (problem === "length") ctx.addIssue({ code: "custom", message: tv("slugLength") })
        if (problem === "format") ctx.addIssue({ code: "custom", message: tv("slugFormat") })
        if (problem === "reserved") ctx.addIssue({ code: "custom", message: tv("slugReserved") })
      }),
      currency: z.enum(CURRENCIES),
      language: z.enum(LANGUAGES),
      categories: z.array(z.enum(CATEGORY_KEYS)).min(1, tv("categoriesRequired")),
      description: z.string().trim().max(LIMITS.shopDescriptionMax, tv("tooLong", { max: LIMITS.shopDescriptionMax })),
      whatsappNumber: z.string().trim().min(1, tv("required")),
      /** Dial-code country for the WhatsApp number (form only; may differ from `country`). */
      whatsappCountry: z.string().min(2, tv("required")),
      city: z.string().trim().min(1, tv("required")).max(LIMITS.cityMax, tv("tooLong", { max: LIMITS.cityMax })),
      country: z.string().min(2, tv("required")),
      logoId: z.string().optional(),
    })
    .superRefine((values, ctx) => {
      if (
        values.whatsappNumber &&
        values.whatsappCountry &&
        normalizeWhatsapp(values.whatsappNumber, values.whatsappCountry as CountryCode) === null
      ) {
        ctx.addIssue({ code: "custom", path: ["whatsappNumber"], message: tv("phoneInvalid") })
      }
    })
}

export type ShopFormValues = z.infer<ReturnType<typeof shopSchema>>
