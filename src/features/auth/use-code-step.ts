"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { AUTH_LOCK_WAIT_S, AUTH_MAX_FAILED_PER_HOUR, RESEND_COOLDOWN_S } from "../../../convex/lib/authCodes"
import { classifyAuthError, type AuthErrorKind, type AuthFlow } from "./auth-error"
import { useAuthErrorMessage } from "./use-auth-error-message"
import { useResendCooldown } from "./use-resend-cooldown"

/**
 * What the sign-up code step and the reset code step share: the error
 * line, "Resend code" with its wait, and the lock after too many wrong
 * codes (the server refuses them anyway; this only says so).
 */
export function useCodeStep({
  flow,
  resend,
  sendError,
}: {
  /** The flow that checks the code (for error messages). */
  flow: Extract<AuthFlow, "email-verification" | "reset-verification">
  /** Asks the server for a new code; throws like `signIn`. */
  resend: () => Promise<void>
  /** The first send failed (e.g. EMAIL_SEND_FAILED): show it, allow a resend now. */
  sendError?: AuthErrorKind | null
}) {
  const t = useTranslations("Auth")
  const message = useAuthErrorMessage()
  const [error, setError] = useState<string | null>(sendError ? message(sendError) : null)
  const [wrong, setWrong] = useState(0)
  const [resending, setResending] = useState(false)
  const cooldown = useResendCooldown(sendError ? 0 : RESEND_COOLDOWN_S)
  const locked = wrong >= AUTH_MAX_FAILED_PER_HOUR

  /** A code check failed: shows why and counts wrong codes. */
  function onCheckError(caught: unknown) {
    const result = classifyAuthError(caught, flow)
    if (result.kind === "invalidCode") {
      const next = wrong + 1
      setWrong(next)
      if (next >= AUTH_MAX_FAILED_PER_HOUR) {
        cooldown.start(AUTH_LOCK_WAIT_S)
        setError(t("tooManyTries", { minutes: AUTH_LOCK_WAIT_S / 60 }))
        return
      }
    }
    setError(message(result))
  }

  async function onResend() {
    setResending(true)
    setError(null)
    try {
      await resend()
      setWrong(0)
      cooldown.start(RESEND_COOLDOWN_S)
      toast.success(t("codeSentAgain"))
    } catch (caught) {
      setError(message(classifyAuthError(caught, flow)))
    } finally {
      setResending(false)
    }
  }

  return {
    error,
    clearError: () => setError(null),
    onCheckError,
    locked,
    resending,
    secondsLeft: cooldown.secondsLeft,
    onResend,
  }
}
