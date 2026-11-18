import { CheckIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Badge } from "@/components/ui/badge"
import { ThemePreviews } from "@/features/marketing/features/theme-previews"

/** Bold/Soft/Dark previews + what sellers can change (looks are coming soon). */
export async function DesignVisual() {
  const t = await getTranslations("Features")
  const tm = await getTranslations("Marketing")
  const available = [t("canShopName"), t("canLogo"), t("canDescription")]
  return (
    <div className="flex flex-col gap-5">
      <ThemePreviews />
      <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-foreground/5">
        <p className="mb-2 text-sm font-semibold text-muted-foreground">{t("designCanChange")}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium">
          {available.map((item) => (
            <li key={item} className="inline-flex items-center gap-1.5">
              <CheckIcon className="size-4 text-success" strokeWidth={3} aria-hidden />
              {item}
            </li>
          ))}
          <li className="inline-flex items-center gap-1.5 text-muted-foreground">
            {t("canColors")}
            <Badge>{tm("comingSoon")}</Badge>
          </li>
        </ul>
      </div>
    </div>
  )
}
