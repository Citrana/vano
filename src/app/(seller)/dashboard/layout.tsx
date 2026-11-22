import { SellerGate } from "@/features/auth/gates"
import { BillingBanner } from "@/features/billing/billing-banner"
import { SellerShell } from "@/features/seller-nav/seller-shell"
import { AnnouncementBanner } from "@/features/shop/announcement-banner"
import { ShopSuspendedBanner } from "@/features/shop/shop-suspended-banner"

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <SellerGate need="shop">
      <SellerShell>
        <AnnouncementBanner />
        <ShopSuspendedBanner />
        <BillingBanner />
        {/* Phones: room for the bottom bar (`--bottom-bar`, set by SellerShell). */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-[calc(var(--bottom-bar)+1.5rem)] md:pb-12">
          {children}
        </main>
      </SellerShell>
    </SellerGate>
  )
}
