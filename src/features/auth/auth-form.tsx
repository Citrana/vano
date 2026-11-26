"use client"

import { useAuthActions } from "@convex-dev/auth/react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { classifyAuthError, isCodeSendProblem, type AuthErrorKind } from "./auth-error"
import { AuthAlert } from "./code-step-parts"
import { credentialsSchema, type Credentials } from "./schemas"
import { useAuthErrorMessage } from "./use-auth-error-message"
import { VerifyEmailStep } from "./verify-email-step"

/**
 * Email + password form for both /login and /signup. `startPlan` (from
 * "Get Business" on the pricing page) is passed on to onboarding.
 *
 * An account whose email isn't confirmed gets no session: Convex Auth
 * emails a code instead (CLAUDE.md "Auth codes") and the card switches to
 * the code step.
 */
export function AuthForm({ flow, startPlan }: { flow: "signIn" | "signUp"; startPlan?: "business" }) {
  const t = useTranslations("Auth")
  const tv = useTranslations("Validation")
  const locale = useLocale()
  const message = useAuthErrorMessage()
  const { signIn } = useAuthActions()
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, setPending] = useState<(Credentials & { sendError: AuthErrorKind | null }) | null>(null)
  const form = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema(tv)),
    defaultValues: { email: "", password: "" },
  })
  const { errors, isSubmitting } = form.formState
  const isSignUp = flow === "signUp"
  const typedEmail = useWatch({ control: form.control, name: "email" })

  function goOn() {
    // New accounts are always sellers. After a sign-in, the page's guest
    // gate sends admins to /admin and sellers to /dashboard.
    if (isSignUp) router.replace(startPlan ? `/onboarding?plan=${startPlan}` : "/onboarding")
  }

  async function onSubmit(values: Credentials) {
    setServerError(null)
    try {
      const { signingIn } = await signIn("password", { ...values, flow, ...(isSignUp ? { language: locale } : {}) })
      if (signingIn) goOn()
      else setPending({ ...values, sendError: null })
    } catch (error) {
      const result = classifyAuthError(error, flow)
      // The account exists but its code didn't go out: "Resend code" retries.
      if (isCodeSendProblem(result)) setPending({ ...values, sendError: result })
      else setServerError(message(result))
    }
  }

  if (pending) {
    return (
      <Card className="w-full max-w-sm gap-6">
        <VerifyEmailStep
          email={pending.email}
          password={pending.password}
          sendError={pending.sendError}
          onVerified={goOn}
          onBack={() => {
            setPending(null)
            form.setValue("password", "")
          }}
        />
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          {isSignUp ? t("signupTitle") : t("loginTitle")}
        </h1>
        {isSignUp ? <p className="text-sm text-muted-foreground">{t("signupSubtitle")}</p> : null}
      </div>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field id="email" label={t("email")} required error={errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" {...form.register("email")} />}
        </Field>
        <div className="flex flex-col gap-1">
          <Field
            id="password"
            label={t("password")}
            required
            help={isSignUp ? t("passwordHelp") : undefined}
            error={errors.password?.message}
          >
            {(p) => (
              <Input
                {...p}
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                {...form.register("password")}
              />
            )}
          </Field>
          {isSignUp ? null : (
            <Link
              href={typedEmail ? `/forgot-password?email=${encodeURIComponent(typedEmail.trim())}` : "/forgot-password"}
              className="inline-flex min-h-11 items-center self-end text-sm font-medium text-foreground underline underline-offset-4"
            >
              {t("forgotLink")}
            </Link>
          )}
        </div>
        {serverError ? <AuthAlert>{serverError}</AuthAlert> : null}
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSignUp ? t("signupButton") : t("loginButton")}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? t("haveAccount") : t("noAccount")}{" "}
        <Link href={isSignUp ? "/login" : "/signup"} className="font-medium text-foreground underline underline-offset-4">
          {isSignUp ? t("goLogin") : t("goSignup")}
        </Link>
      </p>
    </Card>
  )
}
