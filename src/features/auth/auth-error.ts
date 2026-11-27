import { errorCodeOf } from "../../../convex/lib/errors"

export type AuthFlow = "signIn" | "signUp" | "email-verification" | "reset" | "reset-verification"

export type AuthErrorKind =
  | { kind: "code"; code: NonNullable<ReturnType<typeof errorCodeOf>> }
  | { kind: "invalidCredentials" }
  | { kind: "invalidCode" }
  | { kind: "unknown" }

/**
 * The server guard (convex/lib/authFlows.ts) turns Convex Auth's sign-in
 * and code failures into one code each: INVALID_CREDENTIALS (wrong
 * password, unknown email, locked) and CODE_INVALID (wrong, expired, used
 * or locked code, or an email with no account), so nothing reveals whether
 * an account exists and production's redacted messages still read right.
 * Convex Auth's plain messages are still recognised as a fallback. Sign-up
 * never fails because an account exists (the owner gets an email instead).
 */
export function classifyAuthError(error: unknown, flow: AuthFlow): AuthErrorKind {
  const codeFlow = flow === "email-verification" || flow === "reset-verification"
  const code = errorCodeOf(error)
  if (code === "INVALID_CREDENTIALS") return { kind: "invalidCredentials" }
  if (code === "CODE_INVALID" && codeFlow) return { kind: "invalidCode" }
  if (code) return { kind: "code", code }
  const message = error instanceof Error ? error.message : String(error)
  if (flow === "signIn" && /InvalidSecret|InvalidAccountId|TooManyFailedAttempts|Invalid credentials/i.test(message)) {
    return { kind: "invalidCredentials" }
  }
  if (codeFlow && /Could not verify code|Invalid code/i.test(message)) {
    return { kind: "invalidCode" }
  }
  return { kind: "unknown" }
}

/**
 * Sign-up or sign-in errors meaning the account exists but its code email
 * didn't go out (send failed, or asked too often): the screen moves to the
 * code step, where "Resend code" is the retry.
 */
export function isCodeSendProblem(result: AuthErrorKind): boolean {
  return result.kind === "code" && (result.code === "EMAIL_SEND_FAILED" || result.code === "CODE_RATE_LIMITED")
}
