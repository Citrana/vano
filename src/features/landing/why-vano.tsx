import { GlobeIcon, LayoutDashboardIcon, LinkIcon, MessageCircleIcon, SmartphoneIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { cn } from "cn"
import { highlight } from "./highlight"
import { Reveal } from "./reveal"
import { Section } from "./section"

export async function WhyVano() {
  const t = await getTranslations("Landing")
  const features = [
    { icon: MessageCircleIcon, title: t("featChat"), body: t("featChatBody"), wide: true },
    { icon: GlobeIcon, title: t("featNoSite"), body: t("featNoSiteBody") },
    { icon: SmartphoneIcon, title: t("featPhone"), body: t("featPhoneBody") },
    { icon: LinkIcon, title: t("featLink"), body: t("featLinkBody") },
    { icon: LayoutDashboardIcon, title: t("featDashboard"), body: t("featDashboardBody") },
  ]
  return (
    <Section id="why" eyebrow={t("whyEyebrow")} title={t.rich("whyTitle", highlight)} subtitle={t("whySubtitle")} className="bg-card/60">
      <ul className="grid gap-4 md:grid-cols-3 md:gap-6">
        {features.map(({ icon: Icon, title, body, wide }, i) => (
          <li key={title} className={cn(wide && "md:col-span-2")}>
            <Reveal delay={(i % 3) * 100} className="h-full">
              <div
                className={cn(
                  "flex h-full gap-4 rounded-2xl p-5 ring-1 ring-foreground/5 md:flex-col md:p-7",
                  wide ? "bg-blush" : "bg-card shadow-soft",
                )}
              >
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-xl",
                    wide ? "bg-success text-white" : "bg-blush text-plum",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className={cn("font-bold", wide ? "text-xl md:text-2xl" : "text-lg")}>{title}</h3>
                  <p className={cn(wide ? "text-foreground/80 md:text-lg" : "text-muted-foreground")}>{body}</p>
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  )
}
