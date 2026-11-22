"use client"

import type { Category } from "../../../../convex/lib/catalog"
import type { Currency } from "../../../../convex/lib/money"
import type { ResolvedLook } from "../../../../convex/lib/looks/resolve"
import type { SocialNetwork } from "../../../../convex/lib/shopInfo"
import { AnnouncementBar } from "@/features/public/announcement-bar"
import type { HeaderShop } from "@/features/public/shop-header-view"
import { ShopInfo } from "@/features/public/shop-info"
import { ShopSections } from "@/features/public/shop-sections"
import { PREVIEW_MAX } from "./section-state"

export type PreviewProduct = {
  _id: string
  name: string
  price: number
  category: Category
  soldOut: boolean
  coverUrl: string | null
  featured?: boolean
  fewLeft?: boolean
  backInStock?: boolean
}

/** The header's fields plus the About and contact details (Shop settings). */
export type PreviewShop = HeaderShop & {
  openingHours?: string | null
  deliveryAreas?: string | null
  socials?: Partial<Record<SocialNetwork, string | null | undefined>>
}

/** The draft's announcement bar, inert (the previews). */
export function PreviewAnnouncement({ look, shop }: { look: ResolvedLook<string>; shop: PreviewShop }) {
  return look.announcement ? <AnnouncementBar announcement={look.announcement} slug={shop.slug} saleLive={false} preview /> : null
}

/**
 * Below the header in the previews: the sections in the draft's order
 * and layout (each capped at PREVIEW_MAX cards), then the About and
 * contact block. The same components as the public page.
 */
export function PreviewBody({
  look,
  shop,
  currency,
  products,
  columns,
}: {
  look: ResolvedLook<string>
  shop: PreviewShop
  currency: Currency
  products: PreviewProduct[]
  columns: "phone" | "responsive"
}) {
  return (
    <>
      <ShopSections
        sections={look.sections}
        products={products}
        slug={shop.slug}
        currency={currency}
        columns={columns}
        maxPerSection={PREVIEW_MAX}
        order={{ slug: shop.slug, currency, label: look.buttons.label, preview: true }}
      />
      {look.sections.about ? (
        <ShopInfo
          shopName={shop.name}
          info={{
            openingHours: shop.openingHours ?? null,
            deliveryAreas: shop.deliveryAreas ?? null,
            socials: shop.socials ?? {},
          }}
        />
      ) : null}
    </>
  )
}
