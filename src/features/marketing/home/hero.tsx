import { CheckIcon, CircleCheckIcon, EyeIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "cn"
import linkIcon from "@/assets/images/icons/link.png"
import whatsappIcon from "@/assets/images/icons/whatsapp.png"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { FloatingCard } from "@/features/marketing/shared/floating-card"
import { HeroParallax } from "@/features/marketing/home/hero-parallax"
import { highlight } from "@/features/marketing/shared/highlight"
import { OpenShopCta } from "@/features/marketing/shared/open-shop-cta"
import { OrderBadge } from "@/features/marketing/home/order-badge"
import { LivePhone } from "@/features/marketing/home/live-phone"
import { PhoneThemeControls } from "@/features/marketing/home/phone-theme"
import { DEMO_PRODUCTS } from "@/features/marketing/demo/demo-shop"
import { TRIAL_MONTHS } from "@/features/marketing/pricing/plans"

export async function Hero() {
  const t = await getTranslations("Home")

  const iconChip = (children: ReactNode, className: string) => (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full lg:size-10", className)}>{children}</span>
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
          <Link href="/demo" className={buttonVariants({ variant: "outline", size: "lg", className: "w-full sm:w-auto" })}>
            {t("seeDemo")}
          </Link>
        </div>
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-base font-medium">
          {[t("trustTrial", { months: TRIAL_MONTHS }), t("trustNoPayment"), t("trustFast")].map((line) => (
            <li key={line} className="inline-flex items-center gap-1.5">
              <CheckIcon className="size-5 text-success" strokeWidth={3} aria-hidden />
              {line}
            </li>
          ))}
        </ul>

        {/*
          Phone + sample cards (demo illustrations, not real data). Positions
          are % of the phone height, chosen to cover only photos and headers,
          never product names or prices. Compact layout below lg.
        */}
        <div className="relative mt-2 pt-10 md:mt-4 lg:pt-0">
          <div className="relative">
            <HeroParallax>
              <LivePhone />
            </HeroParallax>

            <Floater delay={300} float={6} className="-top-[7%] -left-9 lg:top-[36%] lg:right-[calc(100%-24px)] lg:left-auto">
              <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-2xl ring-2 ring-success/60 [animation-delay:1.2s] motion-reduce:hidden" />
              <FloatingCard
                className="relative w-max max-w-[15rem] lg:max-w-none"
                icon={
                  <span className="relative shrink-0">
                    <Image src={whatsappIcon} alt="" width={40} height={40} className="size-8 lg:size-10" />
                    <OrderBadge />
                  </span>
                }
                title={t("floatOrderTitle")}
                body={
                  <span className="inline-flex items-center gap-1.5">
                    <Image src={DEMO_PRODUCTS[0].photos[0]} alt="" width={16} height={20} className="rounded-sm object-cover" />
                    {t("floatOrderBody")}
                  </span>
                }
              />
            </Floater>

            <Floater delay={450} float={7} className="top-[8%] -right-9 lg:top-[5%] lg:right-auto lg:left-[calc(100%-24px)]">
              <FloatingCard
                className="w-max max-w-[10.5rem] lg:max-w-[16rem]"
                icon={iconChip(<EyeIcon className="size-4 text-plum lg:size-5" aria-hidden />, "bg-blush")}
                title={t("floatViewers", { count: 12 })}
              />
            </Floater>

            <Floater delay={600} float={6.5} className="-right-9 -bottom-[6%] lg:top-[42%] lg:right-auto lg:bottom-auto lg:left-[calc(100%-24px)]">
              <FloatingCard
                className="w-max"
                icon={iconChip(<Image src={linkIcon} alt="" width={20} height={20} className="size-4 lg:size-5" />, "bg-blush")}
                title={t("floatLinkTitle")}
                body={<span className="font-mono font-medium text-foreground">{t("floatLinkUrl")}</span>}
              />
            </Floater>

            <Floater delay={750} float={5.5} className="-right-5 bottom-[7%] lg:top-[56%] lg:right-auto lg:bottom-auto lg:left-[calc(100%+24px)]">
              <FloatingCard
                variant="toast"
                icon={iconChip(<CheckIcon className="size-3.5 lg:size-4" strokeWidth={3} aria-hidden />, "size-6 bg-success text-white lg:size-7")}
                title={t("floatCopied")}
              />
            </Floater>

            <Floater delay={900} float={7.5} className="top-[58%] -left-9 lg:right-[calc(100%-24px)] lg:left-auto">
              <FloatingCard
                tone="success"
                className="w-max"
                icon={iconChip(<CircleCheckIcon className="size-4 lg:size-5" aria-hidden />, "bg-success/15 text-whatsapp")}
                title={<span className="whitespace-nowrap">{t("floatConfirmedTitle")}</span>}
                body={<span className="hidden lg:inline">{t("floatConfirmedBody")}</span>}
              />
            </Floater>
          </div>
          <div className="mt-14 lg:mt-6">
            <PhoneThemeControls />
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * Positions a hero card: fades/slides in after `delay` ms, then floats
 * gently with its own `float` period. Transform/opacity only (no layout
 * shift); static when the visitor prefers reduced motion.
 */
function Floater({ delay, float, className, children }: { delay: number; float: number; className: string; children: ReactNode }) {
  return (
    <div className={cn("absolute z-10 animate-card-in motion-reduce:animate-none", className)} style={{ animationDelay: `${delay}ms` }}>
      <div
        className="relative animate-float motion-reduce:animate-none"
        style={{ animationDuration: `${float}s`, animationDelay: `-${(delay / 300).toFixed(1)}s` }}
      >
        {children}
      </div>
    </div>
  )
}
