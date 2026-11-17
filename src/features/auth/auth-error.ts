import { errorCodeOf } from "../../../convex/lib/errors"

export type AuthErrorKind =
  | { kind: "code"; code: NonNullable<ReturnType<typeof errorCodeOf>> }
  | { kind: "invalidCredentials" }
  | { kind: "accountExists" }
  | { kind: "unknown" }

/**
 * Convex Auth reports sign-in failures with plain messages
 * ("InvalidSecret", "InvalidAccountId", "Account … already exists"); our
 * own profile checks throw ConvexError codes.
 */
export function classifyAuthError(error: unknown, flow: "signIn" | "signUp"): AuthErrorKind {
  const code = errorCodeOf(error)
  if (code) return { kind: "code", code }
  const message = error instanceof Error ? error.message : String(error)
  if (/already exists/i.test(message)) return { kind: "accountExists" }
  if (flow === "signIn" && /InvalidSecret|InvalidAccountId|TooManyFailedAttempts|Invalid credentials/i.test(message)) {
    return { kind: "invalidCredentials" }
  }
  return { kind: "unknown" }
}
