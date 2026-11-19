"use client"

import { useQuery } from "convex/react"
import { Suspense } from "react"
import { api } from "../../../../../convex/_generated/api"
import { ErrorState } from "@/components/states/states"
import { QueryBoundary } from "@/components/states/query-boundary"
import { Skeleton } from "@/components/ui/skeleton"
import { LookEditor } from "@/features/shop-looks/editor/look-editor"

/** Loading: the editor's shape (tabs, options, phone), so nothing jumps. */
function LookEditorSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <Skeleton className="h-8 w-40" />
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[176px_minmax(0,1fr)_300px] lg:gap-6">
        <Skeleton className="h-[26dvh] w-full lg:hidden" />
        <div className="flex gap-2 lg:flex-col">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11 w-24 shrink-0 rounded-full lg:w-full lg:rounded-md" />
          ))}
        </div>
        <Skeleton className="hidden h-96 rounded-xl lg:block" />
        <Skeleton className="hidden h-[560px] rounded-[2.5rem] lg:block" />
      </div>
    </div>
  )
}

function ShopLookPage() {
  const mine = useQuery(api.shopLooks.mine, {})
  const shop = useQuery(api.shops.myShop, {})
  const products = useQuery(api.products.listMine, {})
  if (mine === undefined || shop === undefined || products === undefined) return <LookEditorSkeleton />
  if (shop === null) return null
  // Keyed by shop: the editor keeps its own draft once loaded.
  return <LookEditor key={shop._id} mine={mine} shop={shop} products={products} />
}

export default function Page() {
  return (
    <QueryBoundary fallback={(retry) => <ErrorState onRetry={retry} />}>
      {/* The section lives in the address (useSearchParams). */}
      <Suspense fallback={<LookEditorSkeleton />}>
        <ShopLookPage />
      </Suspense>
    </QueryBoundary>
  )
}
