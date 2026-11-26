"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "convex/react"
import { InfoIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { api } from "../../../../convex/_generated/api"
import { ANNOUNCEMENT_MAX } from "../../../../convex/lib/settings"
import { PageTitle } from "@/components/shell/page-title"
import { LoadingState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useErrorMessage } from "@/lib/use-error-message"
import { useAdminViewer } from "../shell/use-admin-viewer"
import { settingsSchema, type SettingsFormValues } from "./schemas"
import { TestEmailCard } from "./test-email-card"

/** /admin/settings: loads the settings, then shows the form. */
export function SettingsSection() {
  const t = useTranslations("AdminSettings")
  const settings = useQuery(api.admin.settings.get, {})
  const { viewer } = useAdminViewer()
  if (settings === undefined || !viewer) return <><PageTitle title={t("title")} /><LoadingState /></>
  const canManage = viewer.permissions.includes("settings.manage")
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title={t("title")} />
      <SettingsForm initial={settings} canManage={canManage} />
      {canManage ? <div className="mt-4"><TestEmailCard /></div> : null}
    </div>
  )
}

function SettingsForm({ initial, canManage }: { initial: SettingsFormValues; canManage: boolean }) {
  const t = useTranslations("AdminSettings")
  const tv = useTranslations("Validation")
  const update = useMutation(api.admin.settings.update)
  const errorMessage = useErrorMessage()
  const form = useForm<SettingsFormValues>({ resolver: zodResolver(settingsSchema(tv)), defaultValues: initial })
  const { errors, isSubmitting, isDirty } = form.formState
  const [en, fr] = useWatch({ control: form.control, name: ["announcementEn", "announcementFr"] })
  const count = (text: string) => t("count", { count: text.length, max: ANNOUNCEMENT_MAX })

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit(async (values) => {
        try {
          await update(values)
          form.reset(values)
          toast.success(t("saved"))
        } catch (error) {
          toast.error(errorMessage(error))
        }
      })}
    >
      {canManage ? null : (
        <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
          <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("readOnly")}
        </p>
      )}
      <fieldset disabled={!canManage} className="flex flex-col gap-4 disabled:opacity-80">
        <Card>
          <CardTitle>{t("signupTitle")}</CardTitle>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span id="signup-label" className="text-sm font-medium">{t("signupLabel")}</span>
              <span className="text-xs text-muted-foreground">{t("signupHelp")}</span>
            </div>
            <Controller
              control={form.control}
              name="signupEnabled"
              render={({ field }) => (
                <Switch
                  aria-labelledby="signup-label"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={!canManage}
                />
              )}
            />
          </div>
        </Card>
        <Card>
          <div className="flex flex-col gap-1">
            <CardTitle>{t("announcementTitle")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("announcementHelp")}</p>
          </div>
          <Field id="announcement-en" label={t("announcementEn")} help={count(en)} error={errors.announcementEn?.message}>
            {(props) => <Textarea {...props} {...form.register("announcementEn")} rows={3} maxLength={ANNOUNCEMENT_MAX} />}
          </Field>
          <Field id="announcement-fr" label={t("announcementFr")} help={count(fr)} error={errors.announcementFr?.message}>
            {(props) => <Textarea {...props} {...form.register("announcementFr")} rows={3} maxLength={ANNOUNCEMENT_MAX} />}
          </Field>
          {en || fr ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => {
                form.setValue("announcementEn", "", { shouldDirty: true })
                form.setValue("announcementFr", "", { shouldDirty: true })
              }}
            >
              {t("clear")}
            </Button>
          ) : null}
        </Card>
      </fieldset>
      {canManage ? (
        <Button type="submit" className="self-start" disabled={isSubmitting || !isDirty}>
          {t("save")}
        </Button>
      ) : null}
    </form>
  )
}
