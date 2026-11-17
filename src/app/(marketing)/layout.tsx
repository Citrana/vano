import { MarketingFooter } from "@/features/marketing/shared/footer"
import { MarketingNav } from "@/features/marketing/shared/nav"
import { PlatformNotice } from "@/features/marketing/shared/platform-notice"

/** Shared shell for the marketing site: announcement banner, nav, footer. */
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <PlatformNotice />
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  )
}
