import { SparklesIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { OpenShopCta } from "@/features/marketing/shared/open-shop-cta"

/** Sticky "this is a demo" strip under the nav, with the sign-up button. */
export async function DemoBanner() {
  const t = await getTranslations("Demo")
  return (
    <div className="sticky top-16 z-30 border-b bg-blush/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-plum md:text-base">
          <SparklesIcon className="size-4 shrink-0" aria-hidden />
          {t("bannerText")}
        </p>
        <OpenShopCta compact />
      </div>
    </div>
  )
}
