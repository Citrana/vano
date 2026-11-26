import { z } from "zod"
import type { useTranslations } from "next-intl"
import { LANGUAGES } from "../../../convex/lib/catalog"
import { normalizeEmail } from "../../../convex/lib/credentials"
import { TEAM_ROLE_IDS } from "../../../convex/lib/team"

type TV = ReturnType<typeof useTranslations<"Validation">>

/** The invite dialog (CLAUDE.md "Team accounts"); the server checks it all again. */
export function inviteSchema(tv: TV) {
  return z.object({
    role: z.enum(TEAM_ROLE_IDS),
    // Optional: an empty email = share the link yourself.
    email: z
      .string()
      .trim()
      .refine((v) => v === "" || normalizeEmail(v) !== null, tv("emailInvalid")),
    language: z.enum(LANGUAGES),
  })
}

export type InviteValues = z.infer<ReturnType<typeof inviteSchema>>
