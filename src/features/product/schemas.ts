import { z } from "zod"
import type { useTranslations } from "next-intl"
import { AUDIENCE_KEYS, CATEGORY_KEYS, CONDITION_KEYS, LIMITS, tagsProblem } from "../../../convex/lib/catalog"
import { costPriceProblem, parseMoneyToMinor, priceProblem } from "../../../convex/lib/money"
import { normalizeProductCode, productCodeProblem } from "../../../convex/lib/productCode"
import { piecesProblem } from "../../../convex/lib/stock"

type TV = ReturnType<typeof useTranslations<"Validation">>

/**
 * Client mirror of `products.create` / `update` rules (same helpers).
 * Money stays text in the form; `parseMoneyToMinor` converts on submit.
 * Pieces and cost price are required on every plan (at least 1 piece for
 * a new product). Images are validated by the images field (count +
 * uploads finished).
 */
export function productSchema(tv: TV, shopCategories: readonly string[], options: { creating: boolean }) {
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
    costPrice: z.string().refine((text) => {
      const minor = parseMoneyToMinor(text)
      return minor !== null && costPriceProblem(minor) === null
    }, tv("costPrice")),
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
    /** Pieces in stock as typed; lib/stock.ts checks the range. */
    pieces: z
      .string()
      .trim()
      .refine(
        (v) => /^\d{1,6}$/.test(v) && piecesProblem(Number(v), options) === null,
        options.creating ? tv("piecesCreate") : tv("pieces"),
      ),
    condition: z.enum(["", ...CONDITION_KEYS]),
    audience: z.enum(["", ...AUDIENCE_KEYS]),
    /** "" = no code; lib/productCode.ts checks the normalised value. */
    code: z
      .string()
      .refine((v) => v.trim() === "" || productCodeProblem(normalizeProductCode(v)) === null, tv("productCode")),
  })
}

export type ProductFormValues = z.infer<ReturnType<typeof productSchema>>
