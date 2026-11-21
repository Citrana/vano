"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { Controller, useForm, type UseFormReturn } from "react-hook-form"
import { toast } from "sonner"
import { api } from "../../../../convex/_generated/api"
import {
  FEATURE_ORDER_MAX,
  PRICING_LABEL_MAX,
  featureDef,
  isFeatureKey,
  type FeatureKey,
  type FeatureValue,
  type PlanConfigData,
} from "../../../../convex/lib/planFeatures"
import { PLAN_IDS, type PlanId } from "../../../../convex/lib/plans"
import { EmptyState } from "@/components/states/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RequiredFieldsHint } from "@/components/ui/required-fields-hint"
import { Switch } from "@/components/ui/switch"
import { usePlanName } from "@/features/billing/use-plan-catalog"
import { useErrorMessage } from "@/lib/use-error-message"
import { FeatureValueControl } from "./feature-value-control"
import { pricingFormValues, pricingSchema, toPricing, type PricingFormValues } from "./schemas"

/** The drawer for one feature: its value on every plan and its pricing-page text. */
export function FeatureDetails({
  featureKey,
  config,
  canEdit,
  onChange,
}: {
  featureKey: string
  config: PlanConfigData & { version: number }
  canEdit: boolean
  onChange: (feature: FeatureKey, plan: PlanId, value: FeatureValue) => void
}) {
  const t = useTranslations("AdminPlans")
  const tf = useTranslations("PlanFeatures")
  const ta = useTranslations("PlanAreas")
  const planName = usePlanName()
  if (!isFeatureKey(featureKey)) return <EmptyState title={t("notFoundTitle")} />
  const key = featureKey
  const def = featureDef(key)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-col gap-1">
          <CardTitle>{tf(`${key}.name`)}</CardTitle>
          <p className="text-sm text-muted-foreground">{tf(`${key}.description`)}</p>
          <span className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="secondary">{ta(def.area)}</Badge>
            <Badge variant="muted">{def.kind === "flag" ? t("kindFlag") : t("kindLimit")}</Badge>
            {def.enforced ? null : <Badge variant="muted">{t("pricingOnly")}</Badge>}
          </span>
          {def.enforced ? null : <p className="pt-1 text-xs text-muted-foreground">{t("pricingOnlyHelp")}</p>}
        </div>
        <ul className="flex flex-col divide-y">
          {PLAN_IDS.map((plan) => (
            <li key={plan} className="flex min-h-12 items-center justify-between gap-3 py-2">
              <span className="font-medium">{planName(plan)}</span>
              <FeatureValueControl
                config={config}
                feature={key}
                plan={plan}
                disabled={!canEdit}
                size="large"
                onChange={(value) => onChange(key, plan, value)}
              />
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{t("inheritHelp")}</p>
      </Card>
      <PricingForm key={key} feature={key} config={config} canEdit={canEdit} />
    </div>
  )
}

function PricingForm({
  feature,
  config,
  canEdit,
}: {
  feature: FeatureKey
  config: PlanConfigData & { version: number }
  canEdit: boolean
}) {
  const t = useTranslations("AdminPlans")
  const tc = useTranslations("Common")
  const update = useMutation(api.admin.plans.updatePricing)
  const errorMessage = useErrorMessage()
  const def = featureDef(feature)
  const form = useForm<PricingFormValues>({
    resolver: zodResolver(pricingSchema(feature, (problem) => t(`errors.${problem}`, { max: PRICING_LABEL_MAX, maxOrder: FEATURE_ORDER_MAX }))),
    values: pricingFormValues(config.features[feature].pricing),
    resetOptions: { keepDirtyValues: true },
  })
  const { errors, isSubmitting, isDirty } = form.formState
  const [base, setBase] = useState(config.version)
  if (!isDirty && base !== config.version) setBase(config.version)

  return (
    <Card aria-labelledby="pricing-text-title">
      <div className="flex flex-col gap-1">
        <CardTitle id="pricing-text-title">{t("pricingTitle")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("pricingHelp")}</p>
      </div>
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await update({ expectedVersion: base, feature, pricing: toPricing(values) })
            form.reset(values)
            toast.success(t("saved"))
          } catch (error) {
            toast.error(errorMessage(error))
          }
        })}
      >
        {canEdit ? <RequiredFieldsHint /> : null}
        <fieldset disabled={!canEdit} className="flex flex-col gap-3">
          <SwitchRow form={form} name="show" label={t("show")} />
          <SwitchRow form={form} name="showOnCard" label={t("showOnCard")} />
          <Field id="pricing-order" label={t("order")} help={t("orderHelp")} error={errors.order?.message}>
            {(p) => <Input {...p} inputMode="numeric" className="w-28" {...form.register("order")} />}
          </Field>
          <TextPair form={form} en="labelEn" fr="labelFr" label={t("tableLabel")} required />
          <TextPair
            form={form}
            en="cardLabelEn"
            fr="cardLabelFr"
            label={t("cardLabel")}
            help={def.kind === "limit" ? t("cardLabelLimitHelp") : undefined}
            required
          />
          {def.kind === "limit" && def.unlimited ? (
            <TextPair form={form} en="unlimitedEn" fr="unlimitedFr" label={t("unlimitedLabel")} />
          ) : null}
          {def.kind === "flag" ? (
            <TextPair form={form} en="offEn" fr="offFr" label={t("offLabel")} help={t("offLabelHelp")} />
          ) : null}
          <TextPair form={form} en="hintEn" fr="hintFr" label={t("hint")} />
        </fieldset>
        {canEdit ? (
          <div className="flex justify-end">
            <Button type="submit" variant="outline" disabled={!isDirty || isSubmitting}>
              {isSubmitting ? tc("saving") : tc("save")}
            </Button>
          </div>
        ) : null}
      </form>
    </Card>
  )
}

function SwitchRow({
  form,
  name,
  label,
}: {
  form: UseFormReturn<PricingFormValues>
  name: "show" | "showOnCard"
  label: string
}) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <label className="flex items-center justify-between gap-3 text-sm font-medium">
          {label}
          <Switch checked={field.value} onCheckedChange={field.onChange} />
        </label>
      )}
    />
  )
}

type TextKey = Exclude<keyof PricingFormValues, "show" | "showOnCard" | "order">

function TextPair({
  form,
  en,
  fr,
  label,
  help,
  required,
}: {
  form: UseFormReturn<PricingFormValues>
  en: TextKey
  fr: TextKey
  label: string
  help?: string
  required?: boolean
}) {
  const t = useTranslations("AdminPlans")
  const errors = form.formState.errors
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field id={`pricing-${en}`} label={`${label} (${t("langEn")})`} required={required} help={help} error={errors[en]?.message}>
        {(p) => <Input {...p} maxLength={PRICING_LABEL_MAX} {...form.register(en)} />}
      </Field>
      <Field id={`pricing-${fr}`} label={`${label} (${t("langFr")})`} required={required} error={errors[fr]?.message}>
        {(p) => <Input {...p} maxLength={PRICING_LABEL_MAX} {...form.register(fr)} />}
      </Field>
    </div>
  )
}
