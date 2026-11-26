"use client"

import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { api } from "../../../../../convex/_generated/api"
import { PageTitle } from "@/components/shell/page-title"
import { LoadingState } from "@/components/states/states"
import { AddProductButton, ProductsSection } from "@/features/product/products-section"

export default function ProductsPage() {
  const t = useTranslations("Dashboard")
  const shop = useQuery(api.shops.myShop, {})
  const products = useQuery(api.products.listMine, {})
  const viewer = useQuery(api.users.viewer, {})

  if (shop === undefined || products === undefined || viewer === undefined) return <LoadingState />
  if (shop === null) return null // SellerGate redirects to onboarding
  // A suspended shop is read-only (the banner explains why); a role that
  // only views products can't add any (CLAUDE.md "Team accounts").
  const canEdit = shop.status !== "suspended" && (viewer?.permissions.includes("ownProducts.manage") ?? false)

  return (
    <div className="flex flex-col">
      <PageTitle
        title={t("products")}
        action={products.length > 0 && canEdit ? <AddProductButton productCount={products.length} /> : null}
      />
      <ProductsSection shop={shop} products={products} canEdit={canEdit} />
    </div>
  )
}
