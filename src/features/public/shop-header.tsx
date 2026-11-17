import { MapPinIcon, StoreIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { countryName } from "@/features/shop/countries"
import type { PublicShop } from "./data"

export async function ShopHeader({ shop, compact = false }: { shop: PublicShop; compact?: boolean }) {
  const t = await getTranslations({ locale: shop.language, namespace: "Public" })
  const logo = (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-card ${compact ? "size-10" : "size-16 md:size-20"}`}>
      {shop.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
        <img src={shop.logoUrl} alt="" className="size-full object-cover" />
      ) : (
        <StoreIcon className="size-1/2 text-muted-foreground" aria-hidden />
      )}
    </span>
  )

  if (compact) {
    return (
      <Link href={`/${shop.slug}`} className="flex min-w-0 items-center gap-3">
        {logo}
        <span className="truncate font-heading text-lg font-semibold">{shop.name}</span>
      </Link>
    )
  }

  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        {logo}
        <div className="min-w-0">
          <h1 className="font-heading text-2xl leading-tight font-semibold text-balance md:text-3xl">{shop.name}</h1>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
            {t("location", { city: shop.city, country: countryName(shop.country, shop.language) })}
          </p>
        </div>
      </div>
      {shop.description ? <p className="max-w-2xl text-pretty text-muted-foreground">{shop.description}</p> : null}
    </header>
  )
}
