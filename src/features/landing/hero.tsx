import { CheckIcon, LinkIcon, MessageCircleIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { demoShopPath } from "./config"
import { FloatingCard } from "./floating-card"
import { highlight } from "./highlight"
import { OpenShopCta } from "./open-shop-cta"
import { PhoneMockup } from "./phone-mockup"
import { SAMPLE_PRODUCTS } from "./photos"

export async function Hero() {
  const t = await getTranslations("Landing")
  const demoHref = demoShopPath ?? "#demo"
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden px-4 pt-10 pb-16 md:pt-16 md:pb-24">
      {/* Soft brand glow (CSS only, no image download). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black_75%,transparent)]">
        <div className="absolute -top-24 -left-32 size-[28rem] rounded-full bg-coral/25 blur-3xl md:size-[36rem]" />
        <div className="absolute top-1/3 -right-40 size-[26rem] rounded-full bg-blush blur-3xl md:size-[34rem]" />
        <div className="absolute bottom-0 left-1/4 size-80 rounded-full bg-plum/10 blur-3xl" />
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 text-center">
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
          <a href={demoHref} className={buttonVariants({ variant: "outline", size: "lg", className: "w-full sm:w-auto" })}>
            {t("seeDemo")}
          </a>
        </div>
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium">
          {[t("trustFree"), t("trustFast")].map((line) => (
            <li key={line} className="inline-flex items-center gap-1.5">
              <CheckIcon className="size-4 text-success" strokeWidth={3} aria-hidden />
              {line}
            </li>
          ))}
        </ul>

        <div className="relative mt-6 flex justify-center md:mt-10">
          <PhoneMockup />
          <FloatingCard
            className="absolute top-[42%] -left-5 w-48 sm:top-24 sm:-left-36 md:-left-60 md:w-64"
            icon={
              <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-success text-white md:size-10">
                <MessageCircleIcon className="size-5" aria-hidden />
              </span>
            }
            title={t("floatOrderTitle")}
            body={
              <span className="inline-flex items-center gap-1.5">
                <Image src={SAMPLE_PRODUCTS[0].src} alt="" width={16} height={20} className="rounded-sm object-cover" />
                {t("floatOrderBody")}
              </span>
            }
          />
          <FloatingCard
            className="absolute -right-5 bottom-20 w-48 sm:-right-32 md:bottom-32 md:-right-56 md:w-60"
            icon={
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blush text-coral-strong md:size-10">
                <LinkIcon className="size-4" aria-hidden />
              </span>
            }
            title={t("floatLinkTitle")}
            body={<span className="font-mono font-medium text-foreground">{t("floatLinkUrl")}</span>}
          />
        </div>
      </div>
    </section>
  )
}
