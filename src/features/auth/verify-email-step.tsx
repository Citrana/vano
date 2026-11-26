"use client"

import { useAuthActions } from "@convex-dev/auth/react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { Controller, useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { AUTH_CODE_TTL_MINUTES } from "../../../convex/lib/authCodes"
import type { AuthErrorKind } from "./auth-error"
import { CodeInput } from "./code-input"
import { AuthAlert, ResendCodeButton } from "./code-step-parts"
import { codeSchema, type CodeValues } from "./schemas"
import { useCodeStep } from "./use-code-step"

/**
 * After sign-up (or signing in to an account that never confirmed its
 * email): the 6-digit code from the email, on the same card. A new code
 * is asked for by signing in again with the same password, kept in
 * memory only for this.
 */
export function VerifyEmailStep({
  email,
  password,
  sendError,
  onVerified,
  onBack,
}: {
  email: string
  password: string
  sendError: AuthErrorKind | null
  onVerified: () => void
  onBack: () => void
}) {
  const t = useTranslations("Auth")
  const tv = useTranslations("Validation")
  const { signIn } = useAuthActions()
  const step = useCodeStep({
    flow: "email-verification",
    sendError,
    resend: async () => {
      await signIn("password", { email, password, flow: "signIn" })
    },
  })
  const form = useForm<CodeValues>({ resolver: zodResolver(codeSchema(tv)), defaultValues: { code: "" } })
  const { errors, isSubmitting } = form.formState

  async function onSubmit({ code }: CodeValues) {
    step.clearError()
    try {
      const { signingIn } = await signIn("password", { email, code, flow: "email-verification" })
      if (signingIn) onVerified()
    } catch (error) {
      form.setValue("code", "")
      step.onCheckError(error)
    }
  }

  const submit = form.handleSubmit(onSubmit)

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">{t("verifyTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t.rich("codeSentTo", {
            email,
            minutes: AUTH_CODE_TTL_MINUTES,
            strong: (chunks) => <strong className="font-semibold break-all text-foreground">{chunks}</strong>,
          })}
        </p>
      </div>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <Field id="verify-code" label={t("codeLabel")} required help={t("checkSpam")} error={errors.code?.message}>
          {(p) => (
            <Controller
              control={form.control}
              name="code"
              render={({ field }) => (
                <CodeInput
                  {...p}
                  autoFocus
                  value={field.value}
                  onChange={field.onChange}
                  onComplete={() => void submit()}
                  disabled={isSubmitting || step.locked}
                />
              )}
            />
          )}
        </Field>
        {step.error ? <AuthAlert>{step.error}</AuthAlert> : null}
        <Button type="submit" size="lg" disabled={isSubmitting || step.locked}>
          {t("verifyButton")}
        </Button>
        <ResendCodeButton secondsLeft={step.secondsLeft} resending={step.resending} onResend={() => void step.onResend()} />
      </form>
      <p className="text-center text-sm text-muted-foreground">
        <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-4">
          {t("changeEmail")}
        </button>
      </p>
    </>
  )
}
