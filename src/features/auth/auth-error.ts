import { errorCodeOf } from "../../../convex/lib/errors"

export type AuthFlow = "signIn" | "signUp" | "email-verification" | "reset" | "reset-verification"

export type AuthErrorKind =
  | { kind: "code"; code: NonNullable<ReturnType<typeof errorCodeOf>> }
  | { kind: "invalidCredentials" }
  | { kind: "accountExists" }
  | { kind: "invalidCode" }
  | { kind: "unknown" }

/**
 * Convex Auth reports sign-in failures with plain messages
 * ("InvalidSecret", "InvalidAccountId", "Account … already exists",
 * "Could not verify code", "Invalid code"); our own checks throw
 * ConvexError codes. A wrong, expired, used or locked code all read the
 * same (Convex Auth doesn't tell them apart).
 */
export function classifyAuthError(error: unknown, flow: AuthFlow): AuthErrorKind {
  const code = errorCodeOf(error)
  if (code) return { kind: "code", code }
  const message = error instanceof Error ? error.message : String(error)
  if (/already exists/i.test(message)) return { kind: "accountExists" }
  if (flow === "signIn" && /InvalidSecret|InvalidAccountId|TooManyFailedAttempts|Invalid credentials/i.test(message)) {
    return { kind: "invalidCredentials" }
  }
  if ((flow === "email-verification" || flow === "reset-verification") && /Could not verify code|Invalid code/i.test(message)) {
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
