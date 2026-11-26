"use client"

import { useAuthActions } from "@convex-dev/auth/react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RequiredFieldsHint } from "@/components/ui/required-fields-hint"
import { AUTH_CODE_TTL_MINUTES } from "../../../convex/lib/authCodes"
import { classifyAuthError } from "./auth-error"
import { CodeInput } from "./code-input"
import { AuthAlert, ResendCodeButton } from "./code-step-parts"
import {
  resetEmailSchema,
  resetPasswordSchema,
  type ResetEmailValues,
  type ResetPasswordValues,
} from "./schemas"
import { useAuthErrorMessage } from "./use-auth-error-message"
import { useCodeStep } from "./use-code-step"

/**
 * "Forgot password?": email → 6-digit code + new password (CLAUDE.md
 * "Auth codes"). The screen never says whether the email has an account;
 * the server answers the same either way. After the change the person is
 * signed in (the guest gate moves them on) and signed out everywhere else.
 */
export function ForgotPasswordForm({ initialEmail }: { initialEmail?: string }) {
  const t = useTranslations("Auth")
  const [email, setEmail] = useState<string | null>(null)
  return (
    <Card className="w-full max-w-sm gap-6">
      {email === null ? (
        <EmailStep initialEmail={initialEmail} onSent={setEmail} />
      ) : (
        <CodeStep email={email} onBack={() => setEmail(null)} />
      )}
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-4">
          {t("backToLogin")}
        </Link>
      </p>
    </Card>
  )
}

function EmailStep({ initialEmail, onSent }: { initialEmail?: string; onSent: (email: string) => void }) {
  const t = useTranslations("Auth")
  const tv = useTranslations("Validation")
  const message = useAuthErrorMessage()
  const { signIn } = useAuthActions()
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<ResetEmailValues>({
    resolver: zodResolver(resetEmailSchema(tv)),
    defaultValues: { email: initialEmail ?? "" },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit({ email }: ResetEmailValues) {
    setServerError(null)
    try {
      await signIn("password", { email, flow: "reset" })
      onSent(email)
    } catch (error) {
      setServerError(message(classifyAuthError(error, "reset")))
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">{t("forgotTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("forgotSubtitle")}</p>
      </div>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field id="reset-email" label={t("email")} required error={errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" autoFocus {...form.register("email")} />}
        </Field>
        {serverError ? <AuthAlert>{serverError}</AuthAlert> : null}
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {serverError ? t("tryAgain") : t("sendCode")}
        </Button>
      </form>
    </>
  )
}

function CodeStep({ email, onBack }: { email: string; onBack: () => void }) {
  const t = useTranslations("Auth")
  const tv = useTranslations("Validation")
  const { signIn } = useAuthActions()
  const step = useCodeStep({
    flow: "reset-verification",
    resend: async () => {
      await signIn("password", { email, flow: "reset" })
    },
  })
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema(tv)),
    defaultValues: { code: "", newPassword: "" },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit({ code, newPassword }: ResetPasswordValues) {
    step.clearError()
    try {
      const { signingIn } = await signIn("password", { email, code, newPassword, flow: "reset-verification" })
      if (signingIn) toast.success(t("passwordChanged"))
    } catch (error) {
      if (classifyAuthError(error, "reset-verification").kind === "invalidCode") form.setValue("code", "")
      step.onCheckError(error)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">{t("verifyTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t.rich("codeSentIfExists", {
            email,
            minutes: AUTH_CODE_TTL_MINUTES,
            strong: (chunks) => <strong className="font-semibold break-all text-foreground">{chunks}</strong>,
          })}
        </p>
      </div>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <RequiredFieldsHint />
        <Field id="reset-code" label={t("codeLabel")} required help={t("checkSpam")} error={errors.code?.message}>
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
                  onComplete={() => form.setFocus("newPassword")}
                  disabled={isSubmitting || step.locked}
                />
              )}
            />
          )}
        </Field>
        <Field id="new-password" label={t("newPassword")} required help={t("passwordHelp")} error={errors.newPassword?.message}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...form.register("newPassword")} />}
        </Field>
        {step.error ? <AuthAlert>{step.error}</AuthAlert> : null}
        <Button type="submit" size="lg" disabled={isSubmitting || step.locked}>
          {t("resetButton")}
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
