import { z } from "zod"
import type { useTranslations } from "next-intl"
import { ROLE_DESCRIPTION_MAX, ROLE_NAME_MAX, ROLE_NAME_MIN, roleNameProblem } from "../../../../convex/lib/permissions"

type TV = ReturnType<typeof useTranslations<"Validation">>

/** Client mirror of `admin.roles.create` / `update` (same helpers). */
export function roleSchema(tv: TV) {
  return z.object({
    name: z
      .string()
      .refine((name) => roleNameProblem(name) === null, tv("nameLength", { min: ROLE_NAME_MIN, max: ROLE_NAME_MAX })),
    description: z.string().trim().max(ROLE_DESCRIPTION_MAX, tv("tooLong", { max: ROLE_DESCRIPTION_MAX })),
    permissions: z.array(z.string()),
  })
}

export type RoleFormValues = z.infer<ReturnType<typeof roleSchema>>
