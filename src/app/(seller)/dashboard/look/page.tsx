"use client"

import { useQuery } from "convex/react"
import { api } from "../../../../../convex/_generated/api"
import { ErrorState, LoadingState } from "@/components/states/states"
import { QueryBoundary } from "@/components/states/query-boundary"
import { LookEditor } from "@/features/shop-looks/editor/look-editor"

function ShopLookPage() {
  const mine = useQuery(api.shopLooks.mine, {})
  const shop = useQuery(api.shops.myShop, {})
  const products = useQuery(api.products.listMine, {})
  if (mine === undefined || shop === undefined || products === undefined) return <LoadingState />
  if (shop === null) return null
  // Keyed by shop: the editor keeps its own draft once loaded.
  return <LookEditor key={shop._id} mine={mine} shop={shop} products={products} />
}

export default function Page() {
  return (
    <QueryBoundary fallback={(retry) => <ErrorState onRetry={retry} />}>
      <ShopLookPage />
    </QueryBoundary>
  )
}
