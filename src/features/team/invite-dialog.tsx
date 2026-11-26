"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { cn } from "cn"
import { api } from "../../../convex/_generated/api"
import { LANGUAGES, type Language } from "../../../convex/lib/catalog"
import { INVITE_TTL_DAYS, TEAM_ROLE_IDS } from "../../../convex/lib/team"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { useErrorMessage } from "@/lib/use-error-message"
import { InviteLink } from "./invite-link"
import { inviteSchema, type InviteValues } from "./schemas"

/** What the dialog shows after a link was made (create or renew). */
export type MadeLink = { token: string; email: string | null }

/**
 * "Invite a member": pick a role (each with what it can do), optionally an
 * email Vano sends the link to, then the one-time link to copy or share on
 * WhatsApp. `made` opens straight on the link (a renewed invite).
 */
export function InviteDialog({
  open,
  onOpenChange,
  shopName,
  made,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  shopName: string
  made?: MadeLink | null
}) {
  const t = useTranslations("Team.invite")
  const tr = useTranslations("TeamRoles")
  const tv = useTranslations("Validation")
  const tl = useTranslations("Languages")
  const locale = useLocale() as Language
  const errorMessage = useErrorMessage()
  const create = useMutation(api.team.createInvite)
  const [link, setLink] = useState<MadeLink | null>(null)
  const [error, setError] = useState<string | null>(null)
  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema(tv)),
    defaultValues: { role: "seller", email: "", language: locale },
  })
  const role = useWatch({ control: form.control, name: "role" })
  const email = useWatch({ control: form.control, name: "email" })
  const { errors, isSubmitting } = form.formState
  const shown = made ?? link

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setLink(null)
      setError(null)
      form.reset({ role: "seller", email: "", language: locale })
    }
  }

  async function onSubmit(values: InviteValues) {
    setError(null)
    try {
      const to = values.email.trim()
      const result = await create({ role: values.role, email: to || undefined, language: values.language })
      setLink({ token: result.token, email: result.emailSent ? to.toLowerCase() : null })
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {shown ? (
          <>
            <DialogTitle>{t("linkTitle")}</DialogTitle>
            <DialogDescription>{t("linkBody", { days: INVITE_TTL_DAYS })}</DialogDescription>
            <InviteLink token={shown.token} shopName={shopName} email={shown.email} />
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>
                {t("done")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("body")}</DialogDescription>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">{t("role")}</legend>
              <div role="radiogroup" aria-label={t("role")} className="grid gap-2">
                {TEAM_ROLE_IDS.map((id) => (
                  <label
                    key={id}
                    className={cn(
                      "flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-lg border p-3 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
                      role === id ? "border-foreground bg-muted" : "bg-card hover:bg-muted",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <input type="radio" value={id} className="sr-only" {...form.register("role")} />
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-4 items-center justify-center rounded-full border border-border-strong",
                          role === id && "border-foreground",
                        )}
                      >
                        {role === id ? <span className="size-2 rounded-full bg-foreground" /> : null}
                      </span>
                      {tr(`${id}.name`)}
                    </span>
                    <span className="pl-6 text-xs text-muted-foreground">{tr(`${id}.description`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Field id="invite-email" label={t("email")} help={t("emailHelp")} error={errors.email?.message}>
              {(p) => <Input {...p} type="email" inputMode="email" autoComplete="off" {...form.register("email")} />}
            </Field>
            {email.trim() ? (
              <Field id="invite-language" label={t("language")}>
                {(p) => (
                  <NativeSelect {...p} {...form.register("language")}>
                    {LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {tl(lang)}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {t("submit")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
