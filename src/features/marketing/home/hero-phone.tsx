import { CheckIcon, CircleCheckIcon, EyeIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Image from "next/image"
import type { ReactNode } from "react"
import { cn } from "cn"
import linkIcon from "@/assets/images/icons/link.png"
import whatsappIcon from "@/assets/images/icons/whatsapp.png"
import { DEMO_PRODUCTS } from "@/features/marketing/demo/demo-shop"
import { HeroParallax } from "@/features/marketing/home/hero-parallax"
import { LivePhone } from "@/features/marketing/home/live-phone"
import { OrderBadge } from "@/features/marketing/home/order-badge"
import { PhoneThemeControls } from "@/features/marketing/home/phone-theme"
import { FloatingCard } from "@/features/marketing/shared/floating-card"

/**
 * The Home phone mock (live demo shop, sample cards, look switcher), shown
 * after the "Why Vano" band. Same layout as when it sat inside the hero.
 */
export async function HeroPhone() {
  const t = await getTranslations("Home")

  const iconChip = (children: ReactNode, className: string) => (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full lg:size-10", className)}>{children}</span>
  )

  return (
    <section className="relative overflow-hidden px-4 pt-4 pb-10 md:pt-8 md:pb-14">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center text-center">
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
              <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-xl ring-2 ring-success/60 [animation-delay:1.2s] motion-reduce:hidden" />
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
