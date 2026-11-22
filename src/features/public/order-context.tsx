"use client"

import { useQuery } from "convex/react"
import { createContext, useContext, useMemo, type ReactNode } from "react"
import { api } from "../../../convex/_generated/api"
import type { OrderLabel } from "../../../convex/lib/looks/buttonDesigns"
import type { Currency } from "../../../convex/lib/money"
import type { PublicSale } from "../../../convex/lib/sales/active"

/** What the product cards need to order on WhatsApp (from the shop page data). */
export type ShopOrder = {
  slug: string
  currency: Currency
  /** The order button's wording, from the shop look (`Public.orderLabels.*`). */
  label: OrderLabel
  whatsappNumber?: string
  /** Marketing demo shop: share links with the demo note, nothing recorded. */
  demo?: boolean
  /** Look editor previews: inert pictures of the buttons. */
  preview?: boolean
}

type LivePrice = { price: number; sale: PublicSale | null }
type OrderValue = ShopOrder & { livePrice: (productId: string) => LivePrice | undefined }

const OrderContext = createContext<OrderValue | null>(null)

/**
 * Gives the product cards their WhatsApp order details. Prices are read
 * live for the whole shop at once (`public.shopPrices`), so a card's
 * message carries the price at tap time (CLAUDE.md "Sales"); until they
 * arrive, the server-rendered prices are used.
 */
export function ShopOrderProvider({ order, children }: { order: ShopOrder; children: ReactNode }) {
  const live = useQuery(api.public.shopPrices, order.demo || order.preview ? "skip" : { slug: order.slug })
  const value = useMemo<OrderValue>(() => {
    const prices = new Map<string, LivePrice>((live ?? []).map((p) => [p._id, { price: p.price, sale: p.sale }]))
    return { ...order, livePrice: (id) => prices.get(id) }
  }, [order, live])
  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>
}

/** The shop's order details, or null outside a shop page (cards then show no actions). */
export function useShopOrder(): OrderValue | null {
  return useContext(OrderContext)
}
