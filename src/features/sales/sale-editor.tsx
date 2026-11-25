"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangleIcon, InfoIcon, ZapIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import type { Category } from "../../../convex/lib/catalog"
import { errorCodeOf, type ErrorCode } from "../../../convex/lib/errors"
import type { Currency } from "../../../convex/lib/money"
import { affectedProducts, bestSaleFor, overlappingSales, publicSale, saleAppliesTo, type SaleLike } from "../../../convex/lib/sales/active"
import { isSteep } from "../../../convex/lib/sales/discount"
import { presetValues, SALE_NAME_MAX, SALE_PRESETS, type SalePreset } from "../../../convex/lib/sales/rules"
import { DISCOUNT_KINDS, type SaleDiscount, type SaleDisplay, type SaleTarget } from "../../../convex/lib/sales/validators"
import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RequiredFieldsHint } from "@/components/ui/required-fields-hint"
import { Switch } from "@/components/ui/switch"
import { ScheduleFields, useNow } from "@/features/shop-looks/editor/schedule-fields"
import { DiscountFields } from "./discount-fields"
import type { PickerProduct } from "./product-picker"
import { SalePreview } from "./sale-preview"
import { initialValues, saleSchema, toDiscount, toTarget, type SaleFormValues } from "./schemas"
import { TargetFields, type TargetValues } from "./target-fields"
import { useSaleLabels } from "./use-sale-labels"

export type EditorProduct = PickerProduct & { category: Category }

export type SaleSubmit = {
  name: string
  discount: SaleDiscount
  target: SaleTarget
  startsAt?: number
  endsAt: number
  display: SaleDisplay
  steepConfirmed: boolean
}

const FIELD_OF: Partial<Record<ErrorCode, keyof SaleFormValues>> = {
  SALE_NAME_INVALID: "name",
  SALE_DISCOUNT_INVALID: "discountValue",
  SALE_NO_PRODUCTS: "discountValue",
  SALE_SCHEDULE_INVALID: "endsAt",
}

const SAMPLE_COUNT = 3

/**
 * Create or edit a sale (CLAUDE.md "Sales"), phone first: quick-start
 * presets, name, discount, which products, dates in the seller's time
 * zone, what the shop shows, a live preview, then an overview to confirm
 * (products affected, a few new prices, overlaps, steep discounts). The
 * same pure rules as the server run here; the server checks again.
 */
export function SaleEditor({
  currency,
  categories,
  products,
  others,
  initial,
  onSubmit,
}: {
  currency: Currency
  categories: readonly Category[]
  products: readonly EditorProduct[]
  /** The shop's other sales (overlap note). */
  others: readonly SaleLike[]
  initial: (SaleLike & { version: number }) | null
  onSubmit: (values: SaleSubmit) => Promise<void>
}) {
  const t = useTranslations("Sales.form")
  const tp = useTranslations("Sales.presets")
  const te = useTranslations("Errors")
  const tCommon = useTranslations("Common")
  const labels = useSaleLabels(currency)
  const now = useNow()
  // Remounts the date fields when a preset fills them in.
  const [scheduleKey, setScheduleKey] = useState(0)
  const [review, setReview] = useState<SaleSubmit | null>(null)
  const [steepConfirmed, setSteepConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema(t, () => now)),
    defaultValues: initialValues(initial),
  })
  const { register, control, setValue, setError, formState } = form
  const { errors } = formState
  const values = useWatch({ control }) as SaleFormValues

  const discount = toDiscount(values)
  const target = toTarget(values)
  const draft = discount && target ? { discount, target } : null
  const affected = draft ? affectedProducts(draft, products, currency) : []

  // The first affected product (else the first chosen one) for the preview.
  const previewProduct = affected[0]?.product ?? products.find((p) => values.productIds.includes(p._id)) ?? null
  const previewSale =
    draft && previewProduct && values.endsAt !== undefined
      ? publicSale(
          bestSaleFor(
            previewProduct,
            [
              {
                _id: "preview",
                name: values.name,
                ...draft,
                startsAt: values.startsAt ?? now,
                endsAt: values.endsAt,
                paused: false,
                display: values.display,
              },
            ],
            currency,
          ),
        )
      : null

  function applyPreset(preset: SalePreset) {
    const p = presetValues(preset, now)
    setValue("name", tp(`${preset}.name`), { shouldValidate: formState.isSubmitted })
    setValue("startsAt", p.startsAt)
    setValue("endsAt", p.endsAt, { shouldValidate: formState.isSubmitted })
    setValue("display", p.display)
    setScheduleKey((k) => k + 1)
  }

  function openReview(v: SaleFormValues) {
    const d = toDiscount(v)!
    const tg = toTarget(v)!
    setSteepConfirmed(false)
    setReview({ name: v.name.trim(), discount: d, target: tg, startsAt: v.startsAt, endsAt: v.endsAt!, display: v.display, steepConfirmed: false })
  }

  async function publish() {
    if (!review) return
    setSaving(true)
    try {
      await onSubmit({ ...review, steepConfirmed })
      setReview(null)
    } catch (error) {
      const code = errorCodeOf(error)
      const field = code ? FIELD_OF[code] : undefined
      setReview(null)
      if (code && field) setError(field, { message: te(code) }, { shouldFocus: true })
      else toast.error(code ? te(code) : te("UNKNOWN"))
    } finally {
      setSaving(false)
    }
  }

  const reviewAffected = review ? affectedProducts(review, products, currency) : []
  const reviewSteep = reviewAffected.some((a) => isSteep(a.product.price, a.price))
  const reviewOverlaps = review
    ? overlappingSales(
        { ...review, _id: initial?._id, startsAt: review.startsAt ?? now },
        others,
        products,
        currency,
      )
    : []
  // Covered by the sale but not lowered (an amount at or above their price).
  const skipped = review ? products.filter((p) => saleAppliesTo(review.target, p)).length - reviewAffected.length : 0

  return (
    <form noValidate onSubmit={form.handleSubmit(openReview)} className="flex flex-col gap-6">
      <Card className="gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ZapIcon className="size-4" aria-hidden />
          {t("presetsTitle")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("presetsHint")}</p>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
          {SALE_PRESETS.map((preset) => (
            <Button key={preset} type="button" variant="outline" className="shrink-0" onClick={() => applyPreset(preset)}>
              {tp(`${preset}.label`)}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="gap-5">
        <RequiredFieldsHint />
        <Field id="sale-name" label={t("name")} required error={errors.name?.message}>
          {(p) => <Input {...p} maxLength={SALE_NAME_MAX} placeholder={t("namePlaceholder")} {...register("name")} />}
        </Field>

        <DiscountFields
          idPrefix="sale"
          kinds={DISCOUNT_KINDS}
          kind={values.discountKind}
          value={values.discountValue}
          onKindChange={(kind) => setValue("discountKind", kind)}
          onValueChange={(v) => setValue("discountValue", v, { shouldValidate: formState.isSubmitted })}
          error={errors.discountValue?.message}
          currency={currency}
        />
        {discount?.kind === "percent" && discount.value > 80 ? (
          <p role="status" className="flex items-start gap-2 text-sm text-tag-warning-foreground">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("steepWarning")}
          </p>
        ) : null}
      </Card>

      <Card className="gap-5">
        <CardTitle className="text-base">{t("whereTitle")}</CardTitle>
        <TargetFields
          idPrefix="sale"
          value={values}
          onChange={(patch) => {
            for (const [key, v] of Object.entries(patch)) {
              setValue(key as keyof TargetValues, v as never, { shouldValidate: formState.isSubmitted })
            }
          }}
          errors={{ productIds: errors.productIds?.message, category: errors.category?.message }}
          categories={categories}
          products={products}
          price={labels.money}
        />
        {draft ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t("affectedLive", { count: affected.length })}
          </p>
        ) : null}
      </Card>

      <Card className="gap-5">
        <CardTitle className="text-base">{t("whenTitle")}</CardTitle>
        <Controller
          control={control}
          name="endsAt"
          render={() => (
            <ScheduleFields
              key={scheduleKey}
              variant="sale"
              schedule={{ startsAt: values.startsAt, endsAt: values.endsAt }}
              disabled={false}
              now={now}
              onCommit={(d) => {
                setValue("startsAt", d.startsAt)
                setValue("endsAt", d.endsAt, { shouldValidate: formState.isSubmitted })
              }}
            />
          )}
        />
        {errors.endsAt ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.endsAt.message}
          </p>
        ) : null}
      </Card>

      <Card className="gap-4">
        <CardTitle className="text-base">{t("showTitle")}</CardTitle>
        {(["badge", "label", "countdown"] as const).map((key) => (
          <Controller
            key={key}
            control={control}
            name={`display.${key}`}
            render={({ field }) => (
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <span id={`display-${key}-label`} className="text-sm font-medium">
                    {t(`display.${key}`)}
                  </span>
                  <span className="text-xs text-muted-foreground">{t(`display.${key}Help`)}</span>
                </div>
                <Switch aria-labelledby={`display-${key}-label`} checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
        ))}
      </Card>

      <Card className="gap-3">
        <CardTitle className="text-base">{t("previewTitle")}</CardTitle>
        <SalePreview product={previewProduct} sale={previewSale} currency={currency} />
      </Card>

      <div className="sticky bottom-[var(--bottom-bar,0px)] -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Button type="submit" size="lg" className="w-full sm:w-auto">
          {t("review")}
        </Button>
      </div>

      <Dialog open={review !== null} onOpenChange={(open) => !open && setReview(null)}>
        <DialogContent>
          <DialogTitle>{t("overviewTitle")}</DialogTitle>
          <DialogDescription>
            {review ? `${review.name} · ${labels.discount(review.discount)}` : null}
          </DialogDescription>
          {review ? (
            <div className="flex flex-col gap-4 text-sm">
              <p className="font-medium">{t("affected", { count: reviewAffected.length })}</p>
              {skipped > 0 ? <p className="text-muted-foreground">{t("skipped", { count: skipped })}</p> : null}
              <ul className="flex flex-col divide-y rounded-lg border">
                {reviewAffected.slice(0, SAMPLE_COUNT).map(({ product, price }) => (
                  <li key={product._id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 truncate">{product.name}</span>
                    <span className="shrink-0 tabular-nums">
                      <s className="mr-2 text-muted-foreground">{labels.money(product.price)}</s>
                      <span className="font-semibold">{labels.money(price)}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground">
                {review.startsAt === undefined
                  ? t("runsFromNow", { end: labels.when(review.endsAt) })
                  : labels.dates(review.startsAt, review.endsAt)}
              </p>
              {reviewOverlaps.length > 0 ? (
                <p className="flex items-start gap-2 rounded-lg bg-muted p-3">
                  <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {t("overlapNote", { names: reviewOverlaps.map((o) => o.sale.name).join(", ") })}
                </p>
              ) : null}
              {reviewSteep ? (
                <label className="flex items-start gap-3 rounded-lg border border-destructive/40 p-3">
                  <input
                    type="checkbox"
                    checked={steepConfirmed}
                    onChange={(e) => setSteepConfirmed(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--ink)]"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 font-medium text-destructive">
                      <AlertTriangleIcon className="size-4" aria-hidden />
                      {t("steepTitle")}
                    </span>
                    {t("steepConfirm")}
                  </span>
                </label>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("keepEditing")}</DialogClose>
            <Button onClick={publish} disabled={saving || reviewAffected.length === 0 || (reviewSteep && !steepConfirmed)}>
              {saving ? tCommon("saving") : initial ? t("saveChanges") : t("publish")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}
