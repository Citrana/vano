import { getTranslations } from "next-intl/server"
import type { ResolvedProfile } from "../../../convex/lib/looks/resolve"
import type { BannerSizing } from "@/features/shop-looks/banner-heights"
import { countryName } from "@/features/shop/countries"
import { profileLabelsFrom } from "@/features/shop-looks/profile/labels"
import { ShopHeaderView, type HeaderShop } from "./shop-header-view"

/** Server header: the location label and decoration words in the shop's language. */
export async function ShopHeader({
  shop,
  profile,
  compact = false,
  onBanner = false,
  sizing,
}: {
  shop: HeaderShop
  /** The look's profile photo; missing = today's default. */
  profile?: ResolvedProfile
  compact?: boolean
  onBanner?: boolean
  /** `phone` inside a phone mockup. */
  sizing?: BannerSizing
}) {
  const t = await getTranslations({ locale: shop.language, namespace: "Public" })
  const locationLabel =
    shop.city && shop.country ? t("location", { city: shop.city, country: countryName(shop.country, shop.language) }) : null
  return (
    <ShopHeaderView
      shop={shop}
      locationLabel={locationLabel}
      labels={profileLabelsFrom((key) => t(key))}
      profile={profile}
      compact={compact}
      onBanner={onBanner}
      sizing={sizing}
    />
  )
}
