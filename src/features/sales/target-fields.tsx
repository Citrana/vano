"use client"

import { useTranslations } from "next-intl"
import type { Category } from "../../../convex/lib/catalog"
import { Field } from "@/components/ui/field"
import { NativeSelect } from "@/components/ui/native-select"
import { ChoiceGroup } from "@/features/shop-looks/editor/choice-group"
import { ProductPicker, type PickerProduct } from "./product-picker"
import type { TargetMode } from "./schemas"

export type TargetValues = {
  targetMode: TargetMode
  productIds: string[]
  category: Category | ""
  excludedIds: string[]
}

/**
 * "Where it applies", shared by the sale and discount code editors:
 * one product, several, a category or the whole shop, with products to
 * leave out of a category / whole-shop discount. Controlled: the form
 * keeps the values (`toTarget` turns them into the server shape).
 */
export function TargetFields({
  idPrefix,
  value,
  onChange,
  errors,
  categories,
  products,
  price,
}: {
  idPrefix: string
  value: TargetValues
  onChange: (patch: Partial<TargetValues>) => void
  errors: { productIds?: string; category?: string }
  categories: readonly Category[]
  products: readonly (PickerProduct & { category: Category })[]
  price: (minor: number) => string
}) {
  const t = useTranslations("Sales.form")
  const tc = useTranslations("Categories")
  const mode = value.targetMode
  const productsError = `${idPrefix}-products-error`

  return (
    <>
      <ChoiceGroup<TargetMode>
        label={t("appliesTo")}
        value={mode}
        wrap
        onChange={(m) =>
          onChange(m === "product" ? { targetMode: m, productIds: value.productIds.slice(0, 1) } : { targetMode: m })
        }
        options={[
          { value: "product", label: t("target.product") },
          { value: "products", label: t("target.products") },
          { value: "category", label: t("target.category") },
          { value: "shop", label: t("target.shop") },
        ]}
      />
      {products.length === 0 ? <p className="text-sm text-muted-foreground">{t("noProducts")}</p> : null}
      {(mode === "product" || mode === "products") && products.length > 0 ? (
        <div className="flex flex-col gap-2">
          <ProductPicker
            label={mode === "product" ? t("chooseOne") : t("chooseSeveral")}
            products={products}
            selected={value.productIds}
            onChange={(productIds) => onChange({ productIds })}
            single={mode === "product"}
            price={(p) => price(p.price)}
            invalid={Boolean(errors.productIds)}
            describedBy={errors.productIds ? productsError : undefined}
          />
          {errors.productIds ? (
            <p id={productsError} role="alert" className="text-xs text-destructive">
              {errors.productIds}
            </p>
          ) : null}
        </div>
      ) : null}
      {mode === "category" ? (
        <Field id={`${idPrefix}-category`} label={t("category")} required error={errors.category}>
          {(p) => (
            <NativeSelect {...p} value={value.category} onChange={(e) => onChange({ category: e.target.value as Category })}>
              <option value="" disabled>
                {t("chooseCategory")}
              </option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {tc(c)}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
      ) : null}
      {(mode === "category" && value.category !== "") || mode === "shop" ? (
        <details className="rounded-lg border px-3 py-2" open={value.excludedIds.length > 0}>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
            {t("excludeTitle", { count: value.excludedIds.length })}
          </summary>
          <div className="pt-2 pb-1">
            <ProductPicker
              label={t("excludeHint")}
              products={mode === "category" ? products.filter((p) => p.category === value.category) : products}
              selected={value.excludedIds}
              onChange={(excludedIds) => onChange({ excludedIds })}
              price={(p) => price(p.price)}
            />
          </div>
        </details>
      ) : null}
    </>
  )
}
