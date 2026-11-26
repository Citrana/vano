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
  const te = useTranslations("Errors")
  const message = useAuthErrorMessage()
  const [error, setError] = useState<string | null>(sendError ? message(sendError) : null)
  const [wrong, setWrong] = useState(0)
  const [resending, setResending] = useState(false)
  const cooldown = useResendCooldown(sendError ? 0 : RESEND_COOLDOWN_S)
  const locked = wrong >= AUTH_MAX_FAILED_PER_HOUR

  /** Counts a wrong code; shows the lock message when there were too many. */
  function countWrong() {
    const next = wrong + 1
    setWrong(next)
    if (next >= AUTH_MAX_FAILED_PER_HOUR) lock()
    else setError(t("invalidCode"))
  }

  function lock() {
    setWrong(AUTH_MAX_FAILED_PER_HOUR)
    cooldown.start(AUTH_LOCK_WAIT_S)
    setError(t("tooManyTries", { minutes: AUTH_LOCK_WAIT_S / 60 }))
  }

  /** A `signIn` code check failed: shows why and counts wrong codes. */
  function onCheckError(caught: unknown) {
    const result = classifyAuthError(caught, flow)
    if (result.kind === "invalidCode") countWrong()
    else setError(message(result))
  }

  /** The answer of `authCodes.checkResetCode` when it isn't ok. */
  function onCheckResult(status: "invalid" | "tooMany") {
    if (status === "tooMany") lock()
    else countWrong()
  }

  /** The code stopped working meanwhile (expired): say so, allow a new one now. */
  function onExpired() {
    setError(te("CODE_EXPIRED"))
    cooldown.start(0)
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
    onCheckResult,
    onExpired,
    locked,
    resending,
    secondsLeft: cooldown.secondsLeft,
    onResend,
  }
}
