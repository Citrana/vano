import type { ProfileBadgeLabels } from "./decorations/art"

/**
 * The text badges' words ("Queen", "New"…) from `Public.profileBadges.*`.
 * Public pages pass a translator in the shop's language; the editor
 * preview its own (`useTranslations("Public")`).
 */
export function profileLabelsFrom(t: (key: `profileBadges.${keyof ProfileBadgeLabels}`) => string): ProfileBadgeLabels {
  return {
    queen: t("profileBadges.queen"),
    bossLady: t("profileBadges.bossLady"),
    new: t("profileBadges.new"),
    sale: t("profileBadges.sale"),
  }
}
