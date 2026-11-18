import { CodeIcon, PaletteIcon, RocketIcon, ServerIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Reveal } from "@/features/marketing/shared/reveal"

/** Short strip instead of a full row: what you don't need. */
export async function NoWebsiteStrip() {
  const t = await getTranslations("Features")
  const items = [
    { icon: PaletteIcon, label: t("noDesigner") },
    { icon: ServerIcon, label: t("noHosting") },
    { icon: CodeIcon, label: t("noCode") },
    { icon: RocketIcon, label: t("readyFirstProduct") },
  ]
  return (
    <Reveal>
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-card px-6 py-6 text-center shadow-soft ring-1 ring-foreground/5 md:flex-row md:justify-between md:text-left">
        <h3 className="text-xl font-extrabold md:text-2xl">{t("noSiteTitle")}</h3>
        <ul className="flex flex-wrap justify-center gap-2">
          {items.map(({ icon: Icon, label }) => (
            <li key={label} className="inline-flex items-center gap-2 rounded-full border bg-background px-3.5 py-2 text-sm font-medium">
              <Icon className="size-4 text-plum" aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  )
}
