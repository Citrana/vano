import { z } from "zod"
import type { useTranslations } from "next-intl"
import { CATEGORY_KEYS, LIMITS, tagsProblem } from "../../../convex/lib/catalog"
import { parseMoneyToMinor, priceProblem } from "../../../convex/lib/money"

type TV = ReturnType<typeof useTranslations<"Validation">>

/**
 * Client mirror of `products.create` / `update` rules (same helpers).
 * `price` stays text in the form; `toMinor` converts on submit. Images are
 * validated by the images field (count + uploads finished).
 */
export function productSchema(tv: TV, shopCategories: readonly string[]) {
  const tags = z.array(z.string()).refine((list) => tagsProblem(list) === null, tv("tagsInvalid"))
  return z.object({
    name: z
      .string()
      .trim()
      .min(LIMITS.productNameMin, tv("nameLength", { min: LIMITS.productNameMin, max: LIMITS.productNameMax }))
      .max(LIMITS.productNameMax, tv("nameLength", { min: LIMITS.productNameMin, max: LIMITS.productNameMax })),
    price: z.string().refine((text) => {
      const minor = parseMoneyToMinor(text)
      return minor !== null && priceProblem(minor) === null
    }, tv("priceInvalid")),
    category: z
      .enum(CATEGORY_KEYS, { error: tv("required") })
      .refine((c) => shopCategories.includes(c), tv("required")),
    description: z
      .string()
      .trim()
      .max(LIMITS.productDescriptionMax, tv("tooLong", { max: LIMITS.productDescriptionMax })),
    sizes: tags,
    colors: tags,
    soldOut: z.boolean(),
  })
}

export type ProductFormValues = z.infer<ReturnType<typeof productSchema>>
