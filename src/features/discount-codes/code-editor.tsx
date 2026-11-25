"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { SparklesIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import type { Category } from "../../../convex/lib/catalog"
import { CODE_MAX, normalizeCode, suggestCode } from "../../../convex/lib/discountCodes/code"
import { CODE_DISCOUNT_KINDS, type CodeDiscount } from "../../../convex/lib/discountCodes/validators"
import { errorCodeOf, type ErrorCode } from "../../../convex/lib/errors"
import type { Currency } from "../../../convex/lib/money"
import { affectedProducts } from "../../../convex/lib/sales/active"
import type { SaleTarget } from "../../../convex/lib/sales/validators"
import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RequiredFieldsHint } from "@/components/ui/required-fields-hint"
import { Switch } from "@/components/ui/switch"
import { DiscountFields } from "@/features/sales/discount-fields"
import type { PickerProduct } from "@/features/sales/product-picker"
import { TargetFields, type TargetValues } from "@/features/sales/target-fields"
import { ScheduleFields, useNow } from "@/features/shop-looks/editor/schedule-fields"
import { codeInitialValues, codeSchema, toCodeDiscount, toMaxUses, toTarget, type CodeFormValues } from "./schemas"
import { useCodeLabels } from "./use-code-labels"

export type CodeEditorProduct = PickerProduct & { category: Category }

export type CodeSubmit = {
  code: string
  discount: CodeDiscount
  target: SaleTarget
  startsAt?: number
  endsAt: number
  maxUses?: number
}

type InitialCode = Parameters<typeof codeInitialValues>[0] & { uses: number }

const FIELD_OF: Partial<Record<ErrorCode, keyof CodeFormValues>> = {
  DISCOUNT_CODE_INVALID: "code",
  DISCOUNT_CODE_TAKEN: "code",
  DISCOUNT_CODE_DISCOUNT_INVALID: "discountValue",
  DISCOUNT_CODE_NO_PRODUCTS: "discountValue",
  DISCOUNT_CODE_SCHEDULE_INVALID: "endsAt",
  DISCOUNT_CODE_MAX_USES_INVALID: "maxUses",
}

const SAMPLE_COUNT = 3

/**
 * Create or edit a discount code (CLAUDE.md "Discount codes"), phone
 * first: the code (with "Suggest one"), the discount, where it applies,
 * dates in the seller's time zone and an optional maximum number of uses,
 * with a few example prices. The discount, target and date fields are the
 * sale editor's; the same pure rules as the server run here.
 */
export function CodeEditor({
  currency,
  categories,
  products,
  initial,
  onSubmit,
}: {
  currency: Currency
  categories: readonly Category[]
  products: readonly CodeEditorProduct[]
  initial: InitialCode | null
  onSubmit: (values: CodeSubmit) => Promise<void>
}) {
  const t = useTranslations("DiscountCodes.form")
  const ts = useTranslations("Sales.form")
  const te = useTranslations("Errors")
  const tCommon = useTranslations("Common")
  const labels = useCodeLabels(currency)
  const now = useNow()
  const [saving, setSaving] = useState(false)
  const uses = initial?.uses ?? 0

  const form = useForm<CodeFormValues>({
    resolver: zodResolver(codeSchema(t, ts, () => now, uses)),
    defaultValues: codeInitialValues(initial),
  })
  const { register, control, setValue, setError, formState } = form
  const { errors } = formState
  const values = useWatch({ control }) as CodeFormValues
  const validate = { shouldValidate: formState.isSubmitted }

  const discount = toCodeDiscount(values)
  const target = toTarget(values)
  const affected = discount && target ? affectedProducts({ discount, target }, products, currency) : []

  async function submit(v: CodeFormValues) {
    setSaving(true)
    try {
      await onSubmit({
        code: normalizeCode(v.code),
        discount: toCodeDiscount(v)!,
        target: toTarget(v)!,
        startsAt: v.startsAt,
        endsAt: v.endsAt!,
        maxUses: toMaxUses(v),
      })
    } catch (error) {
      const code = errorCodeOf(error)
      const field = code ? FIELD_OF[code] : undefined
      if (code && field) setError(field, { message: te(code) }, { shouldFocus: true })
      else toast.error(code ? te(code) : te("UNKNOWN"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-6">
      <Card className="gap-5">
        <RequiredFieldsHint />
        <Field id="code-text" label={t("code")} required help={t("codeHelp")} error={errors.code?.message}>
          {(p) => (
            <div className="flex gap-2">
              <Input
                {...p}
                maxLength={CODE_MAX + 4}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="WELCOME10"
                className="font-mono tracking-wide uppercase"
                {...register("code")}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => setValue("code", suggestCode(), validate)}
              >
                <SparklesIcon aria-hidden />
                {t("suggest")}
              </Button>
            </div>
          )}
        </Field>
        <DiscountFields
          idPrefix="code"
          kinds={CODE_DISCOUNT_KINDS}
          kind={values.discountKind}
          value={values.discountValue}
          onKindChange={(kind) => setValue("discountKind", kind)}
          onValueChange={(v) => setValue("discountValue", v, validate)}
          error={errors.discountValue?.message}
          currency={currency}
        />
      </Card>

      <Card className="gap-5">
        <CardTitle className="text-base">{ts("whereTitle")}</CardTitle>
        <TargetFields
          idPrefix="code"
          value={values}
          onChange={(patch) => {
            for (const [key, v] of Object.entries(patch)) {
              setValue(key as keyof TargetValues, v as never, validate)
            }
          }}
          errors={{ productIds: errors.productIds?.message, category: errors.category?.message }}
          categories={categories}
          products={products}
          price={labels.money}
        />
        {discount && target ? (
          <div role="status" className="flex flex-col gap-2 text-sm">
            <p className="text-muted-foreground">{ts("affectedLive", { count: affected.length })}</p>
            {affected.length > 0 ? (
              <ul className="flex flex-col divide-y rounded-lg border">
                {affected.slice(0, SAMPLE_COUNT).map(({ product, price }) => (
                  <li key={product._id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 truncate">{product.name}</span>
                    <span className="shrink-0 tabular-nums">
                      <s className="mr-2 text-muted-foreground">{labels.money(product.price)}</s>
                      <span className="font-semibold">{labels.money(price)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card className="gap-5">
        <CardTitle className="text-base">{ts("whenTitle")}</CardTitle>
        <Controller
          control={control}
          name="endsAt"
          render={() => (
            <ScheduleFields
              variant="sale"
              schedule={{ startsAt: values.startsAt, endsAt: values.endsAt }}
              disabled={false}
              now={now}
              onCommit={(d) => {
                setValue("startsAt", d.startsAt)
                setValue("endsAt", d.endsAt, validate)
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
        <Controller
          control={control}
          name="limitUses"
          render={({ field }) => (
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span id="code-limit-label" className="text-sm font-medium">
                  {t("limitUses")}
                </span>
                <span className="text-xs text-muted-foreground">{t("limitUsesHelp")}</span>
              </div>
              <Switch aria-labelledby="code-limit-label" checked={field.value} onCheckedChange={field.onChange} />
            </div>
          )}
        />
        {values.limitUses ? (
          <Field
            id="code-max-uses"
            label={t("maxUses")}
            required
            help={uses > 0 ? t("usedSoFar", { count: uses }) : undefined}
            error={errors.maxUses?.message}
          >
            {(p) => <Input {...p} inputMode="numeric" autoComplete="off" className="tabular-nums sm:max-w-40" placeholder="100" {...register("maxUses")} />}
          </Field>
        ) : null}
      </Card>

      <div className="sticky bottom-[var(--bottom-bar,0px)] -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={saving}>
          {saving ? tCommon("saving") : initial ? t("save") : t("create")}
        </Button>
      </div>
    </form>
  )
}
