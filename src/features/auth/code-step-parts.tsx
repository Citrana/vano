"use client"

import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { formatWait } from "./code-input-logic"

/** The red message box of the auth screens. */
export function AuthAlert({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  )
}

/** "Resend code", or "Resend code in 0:42" while waiting. */
export function ResendCodeButton({
  secondsLeft,
  resending,
  onResend,
}: {
  secondsLeft: number
  resending: boolean
  onResend: () => void
}) {
  const t = useTranslations("Auth")
  const waiting = secondsLeft > 0
  return (
    <Button type="button" variant="ghost" size="lg" disabled={waiting || resending} onClick={onResend}>
      {waiting ? t("resendIn", { time: formatWait(secondsLeft) }) : t("resend")}
    </Button>
  )
}
