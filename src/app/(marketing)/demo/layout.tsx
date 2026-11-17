import { DemoBanner } from "@/features/marketing/demo/demo-banner"
import { DemoThemeScope } from "@/features/marketing/demo/demo-theme"

/** Demo shop: banner + a themed shop area that keeps its look across pages. */
export default function DemoLayout({ children }: LayoutProps<"/demo">) {
  return (
    <>
      <DemoBanner />
      <DemoThemeScope className="min-h-[70vh]">{children}</DemoThemeScope>
    </>
  )
}
