import { SellerHeader } from "@/components/shell/seller-header"
import { SellerGate } from "@/features/auth/gates"

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <SellerGate need="shop">
      <SellerHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-12">{children}</main>
    </SellerGate>
  )
}
