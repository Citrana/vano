"use client"

import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { api } from "../../../convex/_generated/api"
import { shownLook } from "../../../convex/lib/looks/clean"
import { resolveLook } from "../../../convex/lib/looks/resolve"
import type { Currency } from "../../../convex/lib/money"
import type { PublicSale } from "../../../convex/lib/sales/active"
import { ProductCard } from "@/features/public/product-card"
import { SaleCountdown } from "@/features/public/sale"
import { ShopLookScope } from "@/features/shop-looks/look-scope"

/**
 * How one product will look in the shop with this sale: the real product
 * card, drawn in the shop's live look (CLAUDE.md "Sales"), before saving.
 */
export function SalePreview({
  product,
  sale,
  currency,
}: {
  product: { _id: string; name: string; price: number; soldOut: boolean; coverUrl: string | null } | null
  sale: PublicSale | null
  currency: Currency
}) {
  const t = useTranslations("Sales.form")
  const mine = useQuery(api.shopLooks.mine, {})
  if (!product) return <p className="text-sm text-muted-foreground">{t("previewEmpty")}</p>
  const look = resolveLook(
    shownLook(mine?.published, { entitled: mine?.entitled ?? false, promoShown: false, decorationShown: false }),
  )
  return (
    <ShopLookScope look={look} className="rounded-xl border bg-background p-4 text-foreground">
      <div className="mx-auto flex w-44 flex-col gap-3">
        {/* A picture of the card: not a link the seller can follow. */}
        <div className="pointer-events-none" inert>
          <ProductCard
            href="#"
            name={product.name}
            price={product.price}
            currency={currency}
            soldOut={product.soldOut}
            coverUrl={product.coverUrl}
            sale={sale}
          />
        </div>
        {sale?.countdown ? <SaleCountdown endsAt={sale.endsAt} /> : null}
      </div>
    </ShopLookScope>
  )
}
