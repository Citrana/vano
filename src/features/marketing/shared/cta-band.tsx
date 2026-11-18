import { getTranslations } from "next-intl/server"
import { highlight } from "@/features/marketing/shared/highlight"
import { OpenShopCta } from "@/features/marketing/shared/open-shop-cta"
import { Reveal } from "@/features/marketing/shared/reveal"

export async function CtaBand() {
  const t = await getTranslations("Marketing")
  return (
    <section aria-labelledby="final-title" className="px-4 pb-16 md:pb-24">
      <Reveal className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-3xl bg-ink px-6 py-14 text-center text-cream md:px-16 md:py-20">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-coral/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-plum/60 blur-3xl" />
        <div className="relative flex flex-col items-center gap-5">
          <h2 id="final-title" className="max-w-3xl font-heading text-3xl leading-tight font-extrabold tracking-tight text-balance md:text-5xl">
            {t.rich("ctaBandTitle", highlight)}
          </h2>
          <p className="max-w-xl text-base text-cream/90 md:text-xl">{t("ctaBandSubtitle")}</p>
          <OpenShopCta className="w-full sm:w-auto [&_[role=status]_p]:text-foreground" />
        </div>
      </Reveal>
    </section>
  )
}
