import { ArrowRightIcon } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { getTrialOffer } from "@/features/marketing/pricing/data"

/** End of the Features page: where to go next (no big CTA block here). */
export async function NextLinks() {
  const t = await getTranslations("Features")
  const offer = await getTrialOffer(await getLocale())
  return (
    <div className="flex flex-col justify-center gap-3 px-4 pt-4 pb-16 sm:flex-row md:pb-24">
      <Link href="/pricing" className={buttonVariants({ variant: "outline", size: "lg" })}>
        {t("ctaPricing", offer)}
        <ArrowRightIcon aria-hidden />
      </Link>
      <Link href="/demo" className={buttonVariants({ variant: "outline", size: "lg" })}>
        {t("ctaDemo")}
        <ArrowRightIcon aria-hidden />
      </Link>
    </div>
  )
}
