"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { api } from "../../../../convex/_generated/api"
import type { Id } from "../../../../convex/_generated/dataModel"
import { GRANT_REASON_MAX } from "../../../../convex/lib/plans"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { RequiredFieldsHint } from "@/components/ui/required-fields-hint"
import { Textarea } from "@/components/ui/textarea"
import { useErrorMessage } from "@/lib/use-error-message"
import { grantSchema, type GrantFormValues } from "./schemas"

/**
 * Grant (any plan from now for N days) or extend (N more days on the
 * current plan). A reason is required; the server checks the permission,
 * the rules and logs it.
 */
export function GrantPlanDialog({
  mode,
  shopId,
  shopName,
}: {
  mode: "grant" | "extend"
  shopId: Id<"shops">
  shopName: string
}) {
  const t = useTranslations("AdminBilling")
  const tv = useTranslations("Validation")
  const tp = useTranslations("Pricing.plans")
  const tc = useTranslations("Common")
  const grant = useMutation(api.admin.billing.grant)
  const extend = useMutation(api.admin.billing.extend)
  const errorMessage = useErrorMessage()
  const [open, setOpen] = useState(false)
  const form = useForm<GrantFormValues>({
    resolver: zodResolver(grantSchema(tv)),
    defaultValues: { plan: "pro", days: "30", reason: "" },
  })
  const { errors, isSubmitting } = form.formState
  const id = (name: string) => `${mode}-${name}`

  return (
    <>
      <Button variant={mode === "grant" ? "outline" : "secondary"} onClick={() => setOpen(true)}>
        {mode === "grant" ? t("grant") : t("extend")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) form.reset()
        }}
      >
        <DialogContent>
          <DialogTitle>{mode === "grant" ? t("grantTitle", { shop: shopName }) : t("extendTitle", { shop: shopName })}</DialogTitle>
          <DialogDescription>{mode === "grant" ? t("grantBody") : t("extendBody")}</DialogDescription>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit(async (values) => {
              try {
                const days = Number(values.days)
                if (mode === "grant") {
                  await grant({ shopId, plan: values.plan, days, reason: values.reason })
                  toast.success(t("granted"))
                } else {
                  await extend({ shopId, days, reason: values.reason })
                  toast.success(t("extended"))
                }
                setOpen(false)
                form.reset()
              } catch (error) {
                toast.error(errorMessage(error))
              }
            })}
          >
            <RequiredFieldsHint />
            {mode === "grant" ? (
              <Field id={id("plan")} label={t("plan")} required error={errors.plan?.message}>
                {(p) => (
                  <NativeSelect {...p} {...form.register("plan")}>
                    {(["pro", "business", "enterprise"] as const).map((plan) => (
                      <option key={plan} value={plan}>{tp(`${plan}.name`)}</option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
            ) : null}
            <Field id={id("days")} label={t("days")} required error={errors.days?.message}>
              {(p) => <Input {...p} inputMode="numeric" {...form.register("days")} />}
            </Field>
            <Field id={id("reason")} label={t("reason")} required help={t("reasonHelp")} error={errors.reason?.message}>
              {(p) => <Textarea {...p} rows={3} maxLength={GRANT_REASON_MAX} {...form.register("reason")} />}
            </Field>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>{tc("cancel")}</DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? tc("saving") : mode === "grant" ? t("grant") : t("extend")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
