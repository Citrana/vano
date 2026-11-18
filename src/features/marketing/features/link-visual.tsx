import { AtSignIcon, MessageCircleIcon, UsersIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { LinkCopyCard } from "@/features/marketing/features/link-copy-card"

/** The copyable shop link + where sellers usually share it (generic icons, no brand logos). */
export async function LinkVisual() {
  const t = await getTranslations("Features")
  const th = await getTranslations("Home")
  const places = [
    { icon: MessageCircleIcon, label: t("shareStatus") },
    { icon: AtSignIcon, label: t("shareInstagram") },
    { icon: UsersIcon, label: t("shareFacebook") },
  ]
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <LinkCopyCard url={th("floatLinkUrl")} label={th("linkCardLabel")} copyLabel={th("copyLink")} copiedLabel={th("floatCopied")} />
      <div aria-hidden className="select-none">
        <p className="mb-2 text-center text-sm font-semibold text-muted-foreground">{t("shareOn")}</p>
        <ul className="grid grid-cols-3 gap-2">
          {places.map(({ icon: Icon, label }) => (
            <li key={label} className="flex flex-col items-center gap-1.5 rounded-2xl bg-card px-2 py-3 text-center text-xs font-medium shadow-soft ring-1 ring-foreground/5">
              <span className="flex size-8 items-center justify-center rounded-full bg-blush text-plum">
                <Icon className="size-4" />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
