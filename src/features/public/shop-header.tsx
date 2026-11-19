import { getTranslations } from "next-intl/server"
import { countryName } from "@/features/shop/countries"
import { ShopHeaderView, type HeaderShop } from "./shop-header-view"

/** Server header: the location label in the shop's language. */
export async function ShopHeader({
  shop,
  compact = false,
  onBanner = false,
}: {
  shop: HeaderShop
  compact?: boolean
  onBanner?: boolean
}) {
  const t = await getTranslations({ locale: shop.language, namespace: "Public" })
  const locationLabel =
    shop.city && shop.country ? t("location", { city: shop.city, country: countryName(shop.country, shop.language) }) : null
  return <ShopHeaderView shop={shop} locationLabel={locationLabel} compact={compact} onBanner={onBanner} />
}
