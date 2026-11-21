"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "convex/react"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { api } from "../../../../convex/_generated/api"
import type { Id } from "../../../../convex/_generated/dataModel"
import {
  FEATURE_KEYS,
  featureDef,
  featureValueProblem,
  isExceptionFeature,
  isFeatureKey,
  type FeatureKey,
  type FeatureValue,
} from "../../../../convex/lib/planFeatures"
import {
  DAY_MS,
  GRANT_DAYS_MAX,
  GRANT_DAYS_MIN,
  GRANT_REASON_MAX,
  GRANT_REASON_MIN,
  grantDaysProblem,
  grantReasonProblem,
} from "../../../../convex/lib/plans"
import { LoadingState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { RequiredFieldsHint } from "@/components/ui/required-fields-hint"
import { Textarea } from "@/components/ui/textarea"
import { useNow } from "@/features/billing/use-billing"
import { useErrorMessage } from "@/lib/use-error-message"
import { exceptionFormSchema, type ExceptionFormValues } from "./schemas"

const EXCEPTION_FEATURES = FEATURE_KEYS.filter(isExceptionFeature)

/**
 * Plan exceptions in the shop drawer (CLAUDE.md "Billing"): a feature or a
 * higher limit for this shop until a date, with a reason. They end by
 * themselves; the central check applies them first. `plans.manage` only.
 */
export function PlanExceptionsCard({ shopId, shopName, isOwnShop }: { shopId: Id<"shops">; shopName: string; isOwnShop: boolean }) {
  const t = useTranslations("PlanExceptions")
  const tf = useTranslations("PlanFeatures")
  const format = useFormatter()
  const rows = useQuery(api.admin.planExceptions.listForShop, { shopId })
  const revoke = useMutation(api.admin.planExceptions.revoke)
  const errorMessage = useErrorMessage()

  if (rows === undefined) return <Card><LoadingState className="py-6" /></Card>
  const valueText = (value: FeatureValue) =>
    value === true ? t("on") : value === null ? t("unlimited") : t("limit", { count: Number(value) })
  const name = (feature: string) => (isFeatureKey(feature) ? tf(`${feature}.name`) : feature)

  return (
    <Card aria-labelledby="plan-exceptions-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle id="plan-exceptions-title">{t("title")}</CardTitle>
        {isOwnShop ? null : <GrantExceptionDialog shopId={shopId} shopName={shopName} />}
      </div>
      {isOwnShop ? <p className="text-sm text-muted-foreground">{t("ownShop")}</p> : null}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {rows.map((e) => (
            <li key={e._id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">
                  {name(e.feature)} · {valueText(e.value)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {e.active
                    ? t("until", { date: format.dateTime(new Date(e.endsAt), { dateStyle: "long" }) })
                    : e.endedReason === "revoked"
                      ? t("revokedOn", { date: format.dateTime(new Date(e.endedAt ?? e.endsAt), { dateStyle: "long" }) })
                      : t("endedOn", { date: format.dateTime(new Date(e.endedAt ?? e.endsAt), { dateStyle: "long" }) })}
                  {e.createdByEmail ? ` · ${e.createdByEmail}` : null}
                </span>
                <span className="text-sm break-words">{e.reason}</span>
              </div>
              {e.active && !isOwnShop ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      await revoke({ exceptionId: e._id })
                      toast.success(t("revoked"))
                    } catch (error) {
                      toast.error(errorMessage(error))
                    }
                  }}
                >
                  {t("revoke")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** The end date sent to the server, counted from the moment of saving. */
function endsAtFrom(days: number): number {
  return Date.now() + days * DAY_MS
}

function toValue(feature: FeatureKey, v: ExceptionFormValues): FeatureValue {
  if (featureDef(feature).kind === "flag") return true
  if (v.unlimited) return null
  return /^\d+$/.test(v.limit.trim()) ? Number(v.limit) : Number.NaN
}

function GrantExceptionDialog({ shopId, shopName }: { shopId: Id<"shops">; shopName: string }) {
  const t = useTranslations("PlanExceptions")
  const tf = useTranslations("PlanFeatures")
  const tv = useTranslations("Validation")
  const tc = useTranslations("Common")
  const format = useFormatter()
  const now = useNow()
  const grant = useMutation(api.admin.planExceptions.grant)
  const errorMessage = useErrorMessage()
  const [open, setOpen] = useState(false)
  const schema = exceptionFormSchema.superRefine((v, ctx) => {
    if (!isFeatureKey(v.feature)) return
    const value = toValue(v.feature, v)
    if (featureValueProblem(v.feature, value) !== null) ctx.addIssue({ code: "custom", path: ["limit"], message: t("limitInvalid") })
    if (!/^\d+$/.test(v.days.trim()) || grantDaysProblem(Number(v.days)) !== null) {
      ctx.addIssue({ code: "custom", path: ["days"], message: tv("daysRange", { min: GRANT_DAYS_MIN, max: GRANT_DAYS_MAX }) })
    }
    if (grantReasonProblem(v.reason) !== null) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: tv("reasonLength", { min: GRANT_REASON_MIN, max: GRANT_REASON_MAX }) })
    }
  })
  const form = useForm<ExceptionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { feature: EXCEPTION_FEATURES[0], limit: "", unlimited: false, days: "30", reason: "" },
  })
  const { errors, isSubmitting } = form.formState
  const [feature, days, unlimited] = useWatch({ control: form.control, name: ["feature", "days", "unlimited"] })
  const def = isFeatureKey(feature) ? featureDef(feature) : null
  const endsAt = /^\d+$/.test(days.trim()) ? now + Number(days) * DAY_MS : null

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {t("add")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) form.reset()
        }}
      >
        <DialogContent>
          <DialogTitle>{t("addTitle", { shop: shopName })}</DialogTitle>
          <DialogDescription>{t("addBody")}</DialogDescription>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit(async (values) => {
              if (!isFeatureKey(values.feature)) return
              try {
                await grant({
                  shopId,
                  feature: values.feature,
                  value: toValue(values.feature, values),
                  endsAt: endsAtFrom(Number(values.days)),
                  reason: values.reason,
                })
                toast.success(t("added"))
                setOpen(false)
                form.reset()
              } catch (error) {
                toast.error(errorMessage(error))
              }
            })}
          >
            <RequiredFieldsHint />
            <Field id="exception-feature" label={t("feature")} required>
              {(p) => (
                <NativeSelect {...p} {...form.register("feature")}>
                  {EXCEPTION_FEATURES.map((key) => (
                    <option key={key} value={key}>{tf(`${key}.name`)}</option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            {def?.kind === "limit" ? (
              <div className="flex flex-col gap-2">
                <Field id="exception-limit" label={t("newLimit")} required={!unlimited} error={errors.limit?.message}>
                  {(p) => <Input {...p} inputMode="numeric" disabled={unlimited} {...form.register("limit")} />}
                </Field>
                {def.unlimited ? (
                  <Controller
                    control={form.control}
                    name="unlimited"
                    render={({ field }) => (
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} />
                        {t("unlimited")}
                      </label>
                    )}
                  />
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("flagHelp")}</p>
            )}
            <Field
              id="exception-days"
              label={t("days")}
              required
              help={endsAt !== null ? t("endsOn", { date: format.dateTime(new Date(endsAt), { dateStyle: "long" }) }) : undefined}
              error={errors.days?.message}
            >
              {(p) => <Input {...p} inputMode="numeric" {...form.register("days")} />}
            </Field>
            <Field id="exception-reason" label={t("reason")} required help={t("reasonHelp")} error={errors.reason?.message}>
              {(p) => <Textarea {...p} rows={3} maxLength={GRANT_REASON_MAX} {...form.register("reason")} />}
            </Field>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>{tc("cancel")}</DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? tc("saving") : t("add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
