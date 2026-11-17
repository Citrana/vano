import { GlobeIcon, LayoutDashboardIcon, LinkIcon, MessageCircleIcon, PaletteIcon, SmartphoneIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { cn } from "cn"
import { Reveal } from "@/features/marketing/shared/reveal"

/** All features; the two flagship ones (look, WhatsApp) are wider and tinted. */
export async function FeatureGrid() {
  const t = await getTranslations("Features")
  const features = [
    { icon: PaletteIcon, title: t("designTitle"), body: t("designBody"), wide: true },
    { icon: LinkIcon, title: t("linkTitle"), body: t("linkBody") },
    { icon: MessageCircleIcon, title: t("whatsappTitle"), body: t("whatsappBody"), wide: true, whatsapp: true },
    { icon: SmartphoneIcon, title: t("phoneTitle"), body: t("phoneBody") },
    { icon: GlobeIcon, title: t("noSiteTitle"), body: t("noSiteBody") },
    { icon: LayoutDashboardIcon, title: t("dashboardTitle"), body: t("dashboardBody") },
  ]
  return (
    <section className="px-4 py-10 md:py-16">
      <ul className="mx-auto grid w-full max-w-6xl gap-4 md:grid-cols-3 md:gap-6">
        {features.map(({ icon: Icon, title, body, wide, whatsapp }, i) => (
          <li key={title} className={cn(wide && "md:col-span-2")}>
            <Reveal delay={(i % 3) * 100} className="h-full">
              <div className={cn("flex h-full flex-col gap-3 rounded-2xl p-6 ring-1 ring-foreground/5 md:p-8", wide ? "bg-blush" : "bg-card shadow-soft")}>
                <span className={cn("flex size-12 items-center justify-center rounded-xl", whatsapp ? "bg-success text-white" : wide ? "bg-card text-plum" : "bg-blush text-plum")}>
                  <Icon className="size-6" aria-hidden />
                </span>
                <h2 className={cn("font-bold", wide ? "text-xl md:text-2xl" : "text-lg")}>{title}</h2>
                <p className={cn("text-base", wide ? "text-foreground/80 md:text-lg" : "text-muted-foreground")}>{body}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  )
}
