import { z } from "zod"
import type { useTranslations } from "next-intl"
import { isCodeShape } from "../../../convex/lib/authCodes"
import { LIMITS } from "../../../convex/lib/catalog"

type TV = ReturnType<typeof useTranslations<"Validation">>

const emailField = (tv: TV) => z.string().trim().toLowerCase().email(tv("emailInvalid"))
const passwordField = (tv: TV) => z.string().min(LIMITS.passwordMin, tv("passwordShort", { min: LIMITS.passwordMin }))
const codeField = (tv: TV) => z.string().refine(isCodeShape, tv("codeIncomplete"))

export function credentialsSchema(tv: TV) {
  return z.object({ email: emailField(tv), password: passwordField(tv) })
}

export type Credentials = z.infer<ReturnType<typeof credentialsSchema>>

/** The emailed code (sign-up verification). */
export function codeSchema(tv: TV) {
  return z.object({ code: codeField(tv) })
}

export type CodeValues = z.infer<ReturnType<typeof codeSchema>>

/** Step 1 of a password reset. */
export function resetEmailSchema(tv: TV) {
  return z.object({ email: emailField(tv) })
}

export type ResetEmailValues = z.infer<ReturnType<typeof resetEmailSchema>>

/** Step 2 of a password reset: the code and the new password. */
export function resetPasswordSchema(tv: TV) {
  return z.object({ code: codeField(tv), newPassword: passwordField(tv) })
}

export type ResetPasswordValues = z.infer<ReturnType<typeof resetPasswordSchema>>
