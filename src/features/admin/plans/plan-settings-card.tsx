"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { api } from "../../../../convex/_generated/api"
import { PLAN_NAME_MAX, TRIAL_MONTHS_MAX, TRIAL_MONTHS_MIN, type PlanSettings } from "../../../../convex/lib/planFeatures"
import { PLAN_CURRENCY, TRIAL_PLAN, type PlanId } from "../../../../convex/lib/plans"
import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RequiredFieldsHint } from "@/components/ui/required-fields-hint"
import { MoneyInput } from "@/components/ui/money-input"
import { Switch } from "@/components/ui/switch"
import { usePlanName } from "@/features/billing/use-plan-catalog"
import { useErrorMessage } from "@/lib/use-error-message"
import { planFormValues, planSchema, toPlanSettings, type PlanFormValues } from "./schemas"

/**
 * One plan: names (EN / FR), monthly and yearly price, the trial length
 * (trial plan only) and whether it's listed on the pricing page. Saves
 * with the config version it was opened on, so a save made by another
 * admin in between is reported instead of overwritten.
 */
export function PlanSettingsCard({
  plan,
  settings,
  version,
  disabled,
}: {
  plan: PlanId
  settings: PlanSettings
  version: number
  disabled: boolean
}) {
  const t = useTranslations("AdminPlans")
  const planName = usePlanName()
  const tc = useTranslations("Common")
  const updatePlan = useMutation(api.admin.plans.updatePlan)
  const errorMessage = useErrorMessage()
  const form = useForm<PlanFormValues>({
    resolver: zodResolver(
      planSchema(plan, (problem) =>
        t(`errors.${problem}`, { max: PLAN_NAME_MAX, min: TRIAL_MONTHS_MIN, maxMonths: TRIAL_MONTHS_MAX }),
      ),
    ),
    values: planFormValues(settings),
    resetOptions: { keepDirtyValues: true },
  })
  const { errors, isSubmitting, isDirty } = form.formState
  const id = (name: string) => `plan-${plan}-${name}`
  // The version the admin started editing from: a save by someone else
  // after that is reported (PLAN_CONFIG_STALE), never silently overwritten.
  const [base, setBase] = useState(version)
  if (!isDirty && base !== version) setBase(version)

  return (
    <Card aria-labelledby={id("title")}>
      <div className="flex items-center justify-between gap-2">
        <CardTitle id={id("title")}>{settings.name.en}</CardTitle>
        <Controller
          control={form.control}
          name="visible"
          render={({ field }) => (
            <label className="flex items-center gap-2 text-sm">
              {t("visible")}
              <Switch checked={field.value} disabled={disabled} onCheckedChange={field.onChange} />
            </label>
          )}
        />
      </div>
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await updatePlan({ expectedVersion: base, plan, settings: toPlanSettings(values) })
            form.reset(values)
            toast.success(t("saved"))
          } catch (error) {
            toast.error(errorMessage(error))
          }
        })}
      >
        {disabled ? null : <RequiredFieldsHint />}
        <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-2">
          <Field id={id("nameEn")} label={t("nameEn")} required error={errors.nameEn?.message}>
            {(p) => <Input {...p} maxLength={PLAN_NAME_MAX} {...form.register("nameEn")} />}
          </Field>
          <Field id={id("nameFr")} label={t("nameFr")} required error={errors.nameFr?.message}>
            {(p) => <Input {...p} maxLength={PLAN_NAME_MAX} {...form.register("nameFr")} />}
          </Field>
          <Field
            id={id("monthly")}
            label={t("monthly")}
            help={plan === "free" ? t("monthlyFreeHelp") : plan === "enterprise" ? t("monthlyCustomHelp") : undefined}
            error={errors.monthly?.message}
          >
            {(p) => <MoneyInput {...p} currency={PLAN_CURRENCY} disabled={plan === "free"} {...form.register("monthly")} />}
          </Field>
          <Field id={id("yearly")} label={t("yearly")} help={t("yearlyHelp")} error={errors.yearly?.message}>
            {(p) => <MoneyInput {...p} currency={PLAN_CURRENCY} disabled={plan === "free"} {...form.register("yearly")} />}
          </Field>
          {plan === TRIAL_PLAN ? (
            <Field id={id("trial")} label={t("trialMonths")} help={t("trialHelp", { business: planName("business") })} error={errors.trialMonths?.message}>
              {(p) => <Input {...p} inputMode="numeric" {...form.register("trialMonths")} />}
            </Field>
          ) : null}
        </fieldset>
        {disabled ? null : (
          <div className="flex justify-end">
            <Button type="submit" variant="outline" disabled={!isDirty || isSubmitting}>
              {isSubmitting ? tc("saving") : tc("save")}
            </Button>
          </div>
        )}
      </form>
    </Card>
  )
}
