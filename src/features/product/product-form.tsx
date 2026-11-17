"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import type { Doc, Id } from "../../../convex/_generated/dataModel"
import { LIMITS, type Category } from "../../../convex/lib/catalog"
import { errorCodeOf, type ErrorCode } from "../../../convex/lib/errors"
import { minorToInput, parseMoneyToMinor } from "../../../convex/lib/money"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { NativeSelect } from "@/components/ui/native-select"
import { RequiredFieldsHint } from "@/components/ui/required-fields-hint"
import { Switch } from "@/components/ui/switch"
import { TagInput } from "@/components/ui/tag-input"
import { Textarea } from "@/components/ui/textarea"
import { ProductImagesField } from "./product-images-field"
import { productSchema, type ProductFormValues } from "./schemas"
import { useProductImages } from "./use-product-images"

export type ProductSubmit = {
  name: string
  price: number
  category: Category
  description?: string
  sizes: string[]
  colors: string[]
  imageIds: Id<"_storage">[]
  soldOut: boolean
}

const FIELD_OF: Partial<Record<ErrorCode, keyof ProductFormValues>> = {
  NAME_INVALID: "name",
  PRICE_INVALID: "price",
  CATEGORY_NOT_IN_SHOP: "category",
  DESCRIPTION_TOO_LONG: "description",
  TAGS_INVALID: "sizes",
}

type ShopInfo = Pick<Doc<"shops">, "currency" | "categories">
type Initial = Pick<Doc<"products">, "name" | "price" | "category" | "description" | "sizes" | "colors" | "soldOut"> & {
  images: Array<{ storageId: Id<"_storage">; url: string | null }>
}

export function ProductForm({
  shop,
  initial,
  onSubmit,
}: {
  shop: ShopInfo
  initial?: Initial
  onSubmit: (values: ProductSubmit) => Promise<void>
}) {
  const t = useTranslations("ProductForm")
  const tv = useTranslations("Validation")
  const te = useTranslations("Errors")
  const tc = useTranslations("Categories")
  const tCommon = useTranslations("Common")
  const images = useProductImages(initial?.images)
  const [imagesError, setImagesError] = useState<string>()

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema(tv, shop.categories)),
    defaultValues: {
      name: initial?.name ?? "",
      price: initial ? minorToInput(initial.price) : "",
      // "" shows the "Choose a category" placeholder; the schema rejects it.
      category: initial?.category ?? (shop.categories.length === 1 ? shop.categories[0] : ("" as Category)),
      description: initial?.description ?? "",
      sizes: initial?.sizes ?? [],
      colors: initial?.colors ?? [],
      soldOut: initial?.soldOut ?? false,
    },
  })
  const { register, control, formState, setError } = form
  const { errors, isSubmitting } = formState

  function checkImages(): boolean {
    if (images.busy) setImagesError(tv("uploadsPending"))
    else if (images.readyIds.length === 0) setImagesError(tv("imagesRequired"))
    else if (images.readyIds.length > LIMITS.maxImages) setImagesError(tv("imagesTooMany", { max: LIMITS.maxImages }))
    else {
      setImagesError(undefined)
      return true
    }
    return false
  }

  async function submit(values: ProductFormValues) {
    if (!checkImages()) return
    try {
      await onSubmit({
        name: values.name,
        price: parseMoneyToMinor(values.price)!,
        category: values.category,
        description: values.description || undefined,
        sizes: values.sizes,
        colors: values.colors,
        imageIds: images.readyIds,
        soldOut: values.soldOut,
      })
    } catch (error) {
      const code = errorCodeOf(error)
      const field = code ? FIELD_OF[code] : undefined
      if (code === "IMAGES_COUNT" || code === "IMAGE_INVALID") setImagesError(te(code))
      else if (code && field) setError(field, { message: te(code) }, { shouldFocus: true })
      else toast.error(code ? te(code) : te("UNKNOWN"))
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        checkImages()
        return form.handleSubmit(submit)(e)
      }}
      className="flex flex-col gap-6"
    >
      <Card className="gap-5">
        <RequiredFieldsHint />
        <ProductImagesField
          items={images.items}
          onAdd={(files) => {
            setImagesError(undefined)
            images.add(files)
          }}
          onRemove={images.remove}
          onMakeCover={images.makeCover}
          error={imagesError}
        />
        <Field id="name" label={t("name")} required error={errors.name?.message}>
          {(p) => <Input {...p} maxLength={LIMITS.productNameMax} placeholder={t("namePlaceholder")} {...register("name")} />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="price"
            label={t("price")}
            required
            help={t("priceHelp", { currency: shop.currency })}
            error={errors.price?.message}
          >
            {(p) => <MoneyInput {...p} currency={shop.currency} placeholder="0" {...register("price")} />}
          </Field>
          <Field id="category" label={t("category")} required error={errors.category?.message}>
            {(p) => (
              <NativeSelect {...p} {...register("category")}>
                <option value="" disabled>
                  {t("chooseCategory")}
                </option>
                {shop.categories.map((c) => (
                  <option key={c} value={c}>
                    {tc(c)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
        </div>
        <Field id="description" label={t("description")} error={errors.description?.message}>
          {(p) => (
            <Textarea
              {...p}
              rows={4}
              maxLength={LIMITS.productDescriptionMax}
              placeholder={t("descriptionPlaceholder")}
              {...register("description")}
            />
          )}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="sizes" label={t("sizes")} help={t("tagsHelp")} error={errors.sizes?.message}>
            {(p) => (
              <Controller
                control={control}
                name="sizes"
                render={({ field }) => (
                  <TagInput
                    id={p.id}
                    aria-invalid={p["aria-invalid"]}
                    aria-describedby={p["aria-describedby"]}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t("sizesPlaceholder")}
                  />
                )}
              />
            )}
          </Field>
          <Field id="colors" label={t("colors")} help={t("tagsHelp")} error={errors.colors?.message}>
            {(p) => (
              <Controller
                control={control}
                name="colors"
                render={({ field }) => (
                  <TagInput
                    id={p.id}
                    aria-invalid={p["aria-invalid"]}
                    aria-describedby={p["aria-describedby"]}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t("colorsPlaceholder")}
                  />
                )}
              />
            )}
          </Field>
        </div>
        <Controller
          control={control}
          name="soldOut"
          render={({ field }) => (
            <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/60 px-3 py-1">
              <div>
                <p id="soldOut-label" className="text-sm font-medium">
                  {t("soldOut")}
                </p>
                <p className="text-xs text-muted-foreground">{t("soldOutHelp")}</p>
              </div>
              <Switch aria-labelledby="soldOut-label" checked={field.value} onCheckedChange={field.onChange} />
            </div>
          )}
        />
      </Card>
      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={isSubmitting}>
          {isSubmitting ? tCommon("saving") : initial ? tCommon("save") : t("create")}
        </Button>
      </div>
    </form>
  )
}
