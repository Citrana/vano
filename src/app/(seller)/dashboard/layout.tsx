import { SellerHeader } from "@/components/shell/seller-header"
import { SellerGate } from "@/features/auth/gates"
import { BillingBanner } from "@/features/billing/billing-banner"
import { AnnouncementBanner } from "@/features/shop/announcement-banner"
import { ShopSuspendedBanner } from "@/features/shop/shop-suspended-banner"

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <SellerGate need="shop">
      <SellerHeader />
      <AnnouncementBanner />
      <ShopSuspendedBanner />
      <BillingBanner />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-12">{children}</main>
    </SellerGate>
  )
}
