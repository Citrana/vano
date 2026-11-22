import { ClockIcon, ExternalLinkIcon, TruckIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { SOCIAL_NETWORKS, socialUrl, type SocialNetwork } from "../../../convex/lib/shopInfo"

export type ShopInfoData = {
  openingHours: string | null
  deliveryAreas: string | null
  socials: Partial<Record<SocialNetwork, string | null>>
}

/**
 * Whether the block has anything the header doesn't already show:
 * opening hours, delivery areas or a social link. The description and the
 * location are in the header, so they never make the block appear.
 */
export function hasShopInfo(info: ShopInfoData): boolean {
  return Boolean(info.openingHours || info.deliveryAreas || SOCIAL_NETWORKS.some((n) => info.socials[n]))
}

/**
 * "About and contact" (CLAUDE.md "Shop looks"): opening hours, delivery
 * areas and social links from Shop settings, only the filled parts, in the
 * product cards' style. Shown when the look's About switch is on and
 * there's something beyond the header. Works in server and client components.
 */
export function ShopInfo({ info, shopName }: { info: ShopInfoData; shopName: string }) {
  const t = useTranslations("Public.about")
  if (!hasShopInfo(info)) return null
  const links = SOCIAL_NETWORKS.flatMap((network) => {
    const handle = info.socials[network]
    return handle ? [{ network, handle }] : []
  })

  return (
    <section aria-labelledby="shop-about" className="flex flex-col gap-4 rounded-xl border bg-card p-3 md:p-4">
      <h2 id="shop-about" className="font-heading text-lg font-bold tracking-tight md:text-xl">
        {t("title")}
      </h2>
      {info.openingHours || info.deliveryAreas ? (
        <dl className="grid gap-3 sm:grid-cols-2">
          {info.openingHours ? <InfoRow icon={<ClockIcon />} label={t("hours")} value={info.openingHours} /> : null}
          {info.deliveryAreas ? <InfoRow icon={<TruckIcon />} label={t("delivery")} value={info.deliveryAreas} /> : null}
        </dl>
      ) : null}
      {links.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={t("follow", { shop: shopName })}>
          {links.map(({ network, handle }) => (
            <li key={network}>
              <a
                href={socialUrl(network, handle)}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="shop-chip inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted focus-ring"
              >
                {t(`networks.${network}`)}
                <ExternalLinkIcon className="size-3.5 text-muted-foreground" aria-hidden />
                <span className="sr-only">{t("opensNewTab")}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-2.5">
      <span aria-hidden className="mt-0.5 text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="text-sm text-pretty">{value}</dd>
      </div>
    </div>
  )
}
