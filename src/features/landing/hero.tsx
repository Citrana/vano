import { CheckIcon, LinkIcon, MessageCircleIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Image from "next/image"
import { cn } from "cn"
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

  const orderCard = (className: string) => (
    <FloatingCard
      className={className}
      icon={
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success text-white">
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
  )
  const linkCard = (className: string) => (
    <FloatingCard
      className={className}
      icon={
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blush text-coral-strong">
          <LinkIcon className="size-4" aria-hidden />
        </span>
      }
      title={t("floatLinkTitle")}
      body={<span className="font-mono font-medium text-foreground">{t("floatLinkUrl")}</span>}
    />
  )

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
          <a href={demoHref} className={buttonVariants({ variant: "outline", size: "lg", className: "w-full sm:w-auto" })}>
            {t("seeDemo")}
          </a>
        </div>
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-base font-medium">
          {[t("trustFree"), t("trustFast")].map((line) => (
            <li key={line} className="inline-flex items-center gap-1.5">
              <CheckIcon className="size-5 text-success" strokeWidth={3} aria-hidden />
              {line}
            </li>
          ))}
        </ul>

        <div className="relative mt-2 flex flex-col items-center md:mt-4">
          {/* Phones: cards sit above/below the phone, touching only the bezel. */}
          {orderCard("relative z-10 -mb-3 w-64 self-start md:hidden")}
          <PhoneMockup />
          {linkCard("relative z-10 -mt-3 w-60 self-end md:hidden")}
          {/* Desktop: cards beside the phone, touching only the bezel. */}
          {orderCard(cn("absolute top-28 right-[calc(100%-0.5rem)] hidden w-72 md:flex"))}
          {linkCard(cn("absolute bottom-36 left-[calc(100%-0.5rem)] hidden w-64 md:flex"))}
        </div>
      </div>
    </section>
  )
}
