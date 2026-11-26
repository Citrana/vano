"use client"

import { useMutation, useQuery } from "convex/react"
import { MailIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "../../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { useErrorMessage } from "@/lib/use-error-message"

/**
 * Admin Settings → Emails: how emails are sent (Resend or log mode) and a
 * "Send test email" button. The test goes to the admin's own address, in
 * the language of this screen.
 */
export function TestEmailCard() {
  const t = useTranslations("AdminSettings")
  const locale = useLocale()
  const status = useQuery(api.admin.emails.status, {})
  const sendTest = useMutation(api.admin.emails.sendTest)
  const errorMessage = useErrorMessage()
  const [sending, setSending] = useState(false)

  return (
    <Card>
      <div className="flex flex-col gap-1">
        <CardTitle>{t("testEmailTitle")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("testEmailHelp")}</p>
      </div>
      {status ? (
        <p className="text-sm">
          {status.provider === "resend" && status.from
            ? t("testEmailResend", { from: status.from })
            : t("testEmailLog")}
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="self-start"
        disabled={sending}
        onClick={async () => {
          setSending(true)
          try {
            const result = await sendTest({ language: locale === "fr" ? "fr" : "en" })
            toast.success(result.provider === "resend" ? t("testEmailSent", { to: result.to }) : t("testEmailLogged"))
          } catch (error) {
            toast.error(errorMessage(error))
          } finally {
            setSending(false)
          }
        }}
      >
        <MailIcon aria-hidden />
        {t("testEmailButton")}
      </Button>
    </Card>
  )
}
