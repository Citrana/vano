import { z } from "zod"
import type { useTranslations } from "next-intl"
import { LIMITS } from "../../../convex/lib/catalog"

type TV = ReturnType<typeof useTranslations<"Validation">>

export function credentialsSchema(tv: TV) {
  return z.object({
    email: z.string().trim().toLowerCase().email(tv("emailInvalid")),
    password: z.string().min(LIMITS.passwordMin, tv("passwordShort", { min: LIMITS.passwordMin })),
  })
}

export type Credentials = z.infer<ReturnType<typeof credentialsSchema>>
