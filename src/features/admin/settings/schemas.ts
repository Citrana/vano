import { z } from "zod"
import type { useTranslations } from "next-intl"
import { ANNOUNCEMENT_MAX, announcementProblem } from "../../../../convex/lib/settings"

type TV = ReturnType<typeof useTranslations<"Validation">>

/** Client mirror of `admin.settings.update` (same rule). */
export function settingsSchema(tv: TV) {
  return z
    .object({
      signupEnabled: z.boolean(),
      announcementEn: z.string().max(ANNOUNCEMENT_MAX, tv("tooLong", { max: ANNOUNCEMENT_MAX })),
      announcementFr: z.string().max(ANNOUNCEMENT_MAX, tv("tooLong", { max: ANNOUNCEMENT_MAX })),
    })
    .superRefine((values, ctx) => {
      if (announcementProblem({ en: values.announcementEn, fr: values.announcementFr }) === "both_required") {
        const path = values.announcementEn.trim() === "" ? "announcementEn" : "announcementFr"
        ctx.addIssue({ code: "custom", path: [path], message: tv("announcementBothRequired") })
      }
    })
}

export type SettingsFormValues = z.infer<ReturnType<typeof settingsSchema>>
