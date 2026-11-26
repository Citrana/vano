import { CheckIcon } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { highlight } from "@/features/marketing/shared/highlight"
import { OpenShopCta } from "@/features/marketing/shared/open-shop-cta"
import { getPlanTexts } from "@/features/marketing/pricing/data"

export async function Hero() {
  const t = await getTranslations("Home")
  const offer = await getPlanTexts(await getLocale())

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden px-4 pt-8 pb-10 md:pt-14 md:pb-14">
      {/* Soft brand glow behind the headline only (CSS, no image download). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[38rem] [mask-image:linear-gradient(to_bottom,black_40%,transparent)] md:h-[44rem]"
      >
        <div className="absolute -top-28 -left-32 size-[24rem] rounded-full bg-coral/20 blur-3xl md:size-[30rem]" />
        <div className="absolute top-10 -right-40 size-[22rem] rounded-full bg-blush blur-3xl md:size-[28rem]" />
      </div>
      {/*
        Fades the hero (and its glow) into the Why Vano band below, ending on
        the band's exact colour: its bg-blush/40 over the cream page, mixed
        opaque here so the glow can't tint the seam.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[120px] bg-linear-to-b from-transparent to-[color-mix(in_srgb,var(--blush)_40%,var(--cream))]"
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 text-center">
        <Badge variant="brand">{t("badge")}</Badge>
        <h1
          id="hero-title"
          className="max-w-4xl font-heading text-4xl leading-[1.08] font-extrabold tracking-tight text-balance sm:text-5xl md:text-7xl"
        >
          {t.rich("heroTitle", highlight)}
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground text-pretty md:text-xl">{t("heroSubtitle")}</p>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <OpenShopCta className="w-full sm:w-auto" />
          <Link href="/demo" className={buttonVariants({ variant: "outline", size: "lg", className: "w-full sm:w-auto" })}>
            {t("seeDemo")}
          </Link>
        </div>
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-base font-medium">
          {[t("trustTrial", offer), t("trustNoPayment"), t("trustFast")].map((line) => (
            <li key={line} className="inline-flex items-center gap-1.5">
              <CheckIcon className="size-5 text-success" strokeWidth={3} aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
