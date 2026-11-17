"use client"

import { useAuthActions } from "@convex-dev/auth/react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { classifyAuthError } from "./auth-error"
import { credentialsSchema, type Credentials } from "./schemas"

/** Email + password form for both /login and /signup. */
export function AuthForm({ flow }: { flow: "signIn" | "signUp" }) {
  const t = useTranslations("Auth")
  const tv = useTranslations("Validation")
  const te = useTranslations("Errors")
  const { signIn } = useAuthActions()
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema(tv)),
    defaultValues: { email: "", password: "" },
  })
  const { errors, isSubmitting } = form.formState
  const isSignUp = flow === "signUp"

  async function onSubmit(values: Credentials) {
    setServerError(null)
    try {
      await signIn("password", { ...values, flow })
      // New accounts are always sellers. After a sign-in, the page's guest
      // gate sends admins to /admin and sellers to /dashboard.
      if (isSignUp) router.replace("/onboarding")
    } catch (error) {
      const result = classifyAuthError(error, flow)
      setServerError(
        result.kind === "code"
          ? te(result.code)
          : result.kind === "invalidCredentials"
            ? t("invalidCredentials")
            : result.kind === "accountExists"
              ? t("accountExists")
              : te("UNKNOWN")
      )
    }
  }

  return (
    <Card className="w-full max-w-sm gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">
          {isSignUp ? t("signupTitle") : t("loginTitle")}
        </h1>
        {isSignUp ? <p className="text-sm text-muted-foreground">{t("signupSubtitle")}</p> : null}
      </div>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field id="email" label={t("email")} required error={errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" {...form.register("email")} />}
        </Field>
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
        {serverError ? (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        ) : null}
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
