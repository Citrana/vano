"use client"

import { useMutation } from "convex/react"
import { useEffect } from "react"
import { api } from "../../../convex/_generated/api"
import { trackOnce } from "@/lib/track-once"

/** Records an anonymous shop or product view, once per session. */
export function ViewTracker(props: { shopId: string } | { productId: string }) {
  const recordShopView = useMutation(api.stats.recordShopView)
  const recordProductView = useMutation(api.stats.recordProductView)
  const id = "shopId" in props ? props.shopId : props.productId
  const kind = "shopId" in props ? "shop" : "product"

  useEffect(() => {
    trackOnce(`${kind}:${id}`, () =>
      kind === "shop" ? recordShopView({ shopId: id }) : recordProductView({ productId: id }),
    )
  }, [kind, id, recordShopView, recordProductView])

  return null
}
