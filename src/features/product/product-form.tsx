"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useState, type ReactNode } from "react"
import { useConvex } from "convex/react"
import { ChevronDownIcon, InfoIcon, LockIcon, SparklesIcon } from "lucide-react"
import { Controller, useForm, useWatch, type FieldErrors } from "react-hook-form"
import { toast } from "sonner"
import { cn } from "cn"
import { api } from "../../../convex/_generated/api"
import type { Doc, Id } from "../../../convex/_generated/dataModel"
import { AUDIENCE_KEYS, CONDITION_KEYS, LIMITS, type Audience, type Category, type Condition } from "../../../convex/lib/catalog"
import { errorCodeOf, type ErrorCode } from "../../../convex/lib/errors"
import { canShopDo } from "../../../convex/lib/entitlements"
import { minorToInput, parseMoneyToMinor } from "../../../convex/lib/money"
import { normalizeProductCode, PRODUCT_CODE_MAX } from "../../../convex/lib/productCode"
import { toPlanLimits } from "../../../convex/lib/planFeatures"
import { FEW_LEFT_MAX } from "../../../convex/lib/stock"
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
import { useShopLimits } from "@/features/billing/use-billing"
import { useUpgradePlanName } from "@/features/billing/use-plan-catalog"
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
  pieces: number
  costPrice: number
  condition?: Condition
  audience?: Audience
  code?: string
}

const FIELD_OF: Partial<Record<ErrorCode, keyof ProductFormValues>> = {
  NAME_INVALID: "name",
  PRICE_INVALID: "price",
  CATEGORY_NOT_IN_SHOP: "category",
  DESCRIPTION_TOO_LONG: "description",
  TAGS_INVALID: "sizes",
  STOCK_INVALID: "pieces",
  COST_PRICE_INVALID: "costPrice",
  PRODUCT_CODE_INVALID: "code",
  PRODUCT_CODE_TAKEN: "code",
}

/** Fields inside "More details": an error there opens the section. */
const DETAIL_FIELDS = ["condition", "audience", "code"] as const

type ShopInfo = Pick<Doc<"shops">, "currency" | "categories">
type Initial = Pick<
  Doc<"products">,
  "name" | "price" | "category" | "description" | "sizes" | "colors" | "soldOut" | "pieces" | "costPrice" | "condition" | "audience" | "code"
> & {
  images: Array<{ storageId: Id<"_storage">; url: string | null }>
}

export function ProductForm({
  shop,
  initial,
  maxImages = LIMITS.maxImages,
  onSubmit,
}: {
  shop: ShopInfo
  initial?: Initial
  /** Photos allowed by the shop's plan (`photoCap`); the server checks again. */
  maxImages?: number
  onSubmit: (values: ProductSubmit) => Promise<void>
}) {
  const t = useTranslations("ProductForm")
  const tv = useTranslations("Validation")
  const te = useTranslations("Errors")
  const tc = useTranslations("Categories")
  const tCommon = useTranslations("Common")
  const tp = useTranslations("Public")
  const convex = useConvex()
  const creating = !initial
  // An older product saved before pieces / cost price were required: ask for them.
  const missingStock = initial !== undefined && (initial.pieces === undefined || initial.costPrice === undefined)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const images = useProductImages(initial?.images, maxImages)
  const billing = useShopLimits()
  const stockPlan = useUpgradePlanName("stockManagement")
  // The count drives Few left / Sold out only with `stockManagement`; the server decides.
  const canCount = billing ? canShopDo(toPlanLimits(billing.limits), { kind: "feature", feature: "stockManagement" }) === null : false
  const [imagesError, setImagesError] = useState<string>()

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema(tv, shop.categories, { creating })),
    defaultValues: {
      name: initial?.name ?? "",
      price: initial ? minorToInput(initial.price) : "",
      // "" shows the "Choose a category" placeholder; the schema rejects it.
      category: initial?.category ?? (shop.categories.length === 1 ? shop.categories[0] : ("" as Category)),
      description: initial?.description ?? "",
      sizes: initial?.sizes ?? [],
      colors: initial?.colors ?? [],
      soldOut: initial?.soldOut ?? false,
      pieces: initial?.pieces !== undefined ? String(initial.pieces) : "",
      costPrice: initial?.costPrice !== undefined ? minorToInput(initial.costPrice) : "",
      condition: initial?.condition ?? "",
      audience: initial?.audience ?? "",
      code: initial?.code ?? "",
    },
  })
  const { register, control, formState, setError, setValue } = form
  const piecesText = useWatch({ control, name: "pieces" })
  const category = useWatch({ control, name: "category" })
  const counted = canCount && piecesText.trim() !== ""
  const { errors, isSubmitting } = formState

  function checkImages(): boolean {
    if (images.busy) setImagesError(tv("uploadsPending"))
    else if (images.readyIds.length === 0) setImagesError(tv("imagesRequired"))
    else if (images.readyIds.length > maxImages) setImagesError(tv("imagesTooMany", { max: maxImages }))
    else {
      setImagesError(undefined)
      return true
    }
    return false
  }

  function openDetailsOnError(fieldErrors: FieldErrors<ProductFormValues>) {
    if (DETAIL_FIELDS.some((f) => fieldErrors[f])) setDetailsOpen(true)
  }

  async function suggestCode() {
    if (!category) return
    setSuggesting(true)
    try {
      const code = await convex.query(api.products.suggestCode, { category })
      setValue("code", code, { shouldDirty: true, shouldValidate: true })
    } catch (error) {
      const code = errorCodeOf(error)
      toast.error(code ? te(code) : te("UNKNOWN"))
    } finally {
      setSuggesting(false)
    }
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
        // Required on every plan; it drives the labels only with `stockManagement`.
        pieces: Number(values.pieces.trim()),
        costPrice: parseMoneyToMinor(values.costPrice)!,
        condition: values.condition || undefined,
        audience: values.audience || undefined,
        code: values.code.trim() === "" ? undefined : normalizeProductCode(values.code),
      })
    } catch (error) {
      const code = errorCodeOf(error)
      const field = code ? FIELD_OF[code] : undefined
      if (code === "IMAGES_COUNT" || code === "IMAGE_INVALID" || code === "PLAN_LIMIT_PHOTOS") setImagesError(te(code))
      else if (code && field) {
        if ((DETAIL_FIELDS as readonly string[]).includes(field)) setDetailsOpen(true)
        setError(field, { message: te(code) }, { shouldFocus: true })
      }
      else toast.error(code ? te(code) : te("UNKNOWN"))
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        checkImages()
        return form.handleSubmit(submit, openDetailsOnError)(e)
      }}
      className="flex flex-col gap-6"
    >
      <Card className="gap-5">
        <RequiredFieldsHint />
        {missingStock ? (
          <p role="status" className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-sm">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            {t("missingStock")}
          </p>
        ) : null}
        <ProductImagesField
          items={images.items}
          onAdd={(files) => {
            setImagesError(undefined)
            images.add(files)
          }}
          onRemove={images.remove}
          onMakeCover={images.makeCover}
          error={imagesError}
          maxImages={maxImages}
          planHint={maxImages < LIMITS.maxImages}
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
          <Field id="costPrice" label={t("costPrice")} required help={t("costPriceHelp")} error={errors.costPrice?.message}>
            {(p) => <MoneyInput {...p} currency={shop.currency} placeholder="0" {...register("costPrice")} />}
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="pieces"
            label={t("pieces")}
            required
            help={canCount ? t("piecesHelp", { few: FEW_LEFT_MAX }) : undefined}
            error={errors.pieces?.message}
          >
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                autoComplete="off"
                placeholder={creating ? "1" : "0"}
                className="tabular-nums"
                {...register("pieces")}
              />
            )}
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
        {!canCount && billing ? (
          <p className="-mt-2 flex items-start gap-2 text-xs text-muted-foreground">
            <LockIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {t("piecesFreeNote", { plan: stockPlan })}
          </p>
        ) : null}
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
        {counted ? (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{t("stockDriven")}</p>
        ) : (
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
        )}
        <MoreDetails
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          title={t("moreDetails")}
          hint={t("moreDetailsHint")}
        >
          <Controller
            control={control}
            name="condition"
            render={({ field }) => (
              <ChoiceChips
                label={t("condition")}
                options={CONDITION_KEYS.map((key) => ({ value: key, label: tp(`conditions.${key}`) }))}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="audience"
            render={({ field }) => (
              <ChoiceChips
                label={t("audience")}
                options={AUDIENCE_KEYS.map((key) => ({ value: key, label: tp(`audiences.${key}`) }))}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Field id="code" label={t("code")} help={t("codeHelp")} error={errors.code?.message}>
            {(p) => (
              <div className="flex gap-2">
                <Input
                  {...p}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={PRODUCT_CODE_MAX + 4}
                  placeholder={t("codePlaceholder")}
                  className="min-w-0 flex-1 uppercase tabular-nums"
                  {...register("code")}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  disabled={!category || suggesting}
                  title={!category ? t("suggestCodeNeedsCategory") : undefined}
                  onClick={suggestCode}
                >
                  <SparklesIcon aria-hidden />
                  {t("suggestCode")}
                </Button>
              </div>
            )}
          </Field>
        </MoreDetails>
      </Card>
      <div className="sticky bottom-[var(--bottom-bar,0px)] -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={isSubmitting}>
          {isSubmitting ? tCommon("saving") : initial ? tCommon("save") : t("create")}
        </Button>
      </div>
    </form>
  )
}

/**
 * The form's optional "More details" (condition, who it's for, product
 * code): a row with a chevron, closed by default, like the product page's
 * sections. Controlled, so a validation error inside can open it.
 */
function MoreDetails({
  open,
  onOpenChange,
  title,
  hint,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  hint: string
  children: ReactNode
}) {
  return (
    <details
      open={open}
      onToggle={(e) => onOpenChange(e.currentTarget.open)}
      className="group -mx-1 rounded-lg border"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-2 focus-ring [&::-webkit-details-marker]:hidden">
        <span className="flex flex-col">
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </span>
        <ChevronDownIcon
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden
        />
      </summary>
      <div className="flex flex-col gap-5 border-t px-3 pt-4 pb-4">{children}</div>
    </details>
  )
}

/** One optional choice as chips; tapping the selected chip clears it. */
function ChoiceChips<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Array<{ value: V; label: string }>
  value: V | ""
  onChange: (value: V | "") => void
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-x-2">
        {options.map((o) => {
          const selected = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? "" : o.value)}
              className="group flex min-h-11 items-center rounded-full focus-ring"
            >
              <span
                className={cn(
                  "flex h-8 items-center rounded-full border px-3 text-sm font-medium whitespace-nowrap transition-colors",
                  selected ? "chip-selected" : "bg-card group-hover:bg-muted",
                )}
              >
                {o.label}
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
