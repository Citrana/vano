import { CheckIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { ThemePreviews } from "@/features/marketing/features/theme-previews"

/** The preset looks + what sellers can change. */
export async function DesignVisual() {
  const t = await getTranslations("Features")
  const available = [t("canShopName"), t("canLogo"), t("canDescription"), t("canColors"), t("canBanner")]
  return (
    <div className="flex flex-col gap-5">
      <ThemePreviews />
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <p className="text-sm font-semibold text-muted-foreground">{t("designCanChange")}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium">
          {available.map((item) => (
            <li key={item} className="inline-flex items-center gap-1.5">
              <CheckIcon className="size-4 text-success" strokeWidth={3} aria-hidden />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">{t("canLooksNote")}</p>
      </div>
    </div>
  )
}
