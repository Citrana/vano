import { Suspense } from "react"
import { LoadingState } from "@/components/states/states"
import { ProductsSection } from "@/features/admin/products/products-section"
import { RequirePermission } from "@/features/admin/shell/admin-gate"

export default function AdminProductsPage() {
  return (
    <RequirePermission permission="products.view">
      {/* The section reads its filters from the URL. */}
      <Suspense fallback={<LoadingState />}>
        <ProductsSection />
      </Suspense>
    </RequirePermission>
  )
}
