import { ProductsSection } from "@/features/admin/products/products-section"
import { RequirePermission } from "@/features/admin/shell/admin-gate"

export default function AdminProductsPage() {
  return (
    <RequirePermission permission="products.view">
      <ProductsSection />
    </RequirePermission>
  )
}
