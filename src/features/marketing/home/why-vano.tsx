import { ArrowRightIcon, LinkIcon, MessageCircleIcon, PaletteIcon } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "cn"
import { formatMoney } from "../../../../convex/lib/money"
import { buttonVariants } from "@/components/ui/button"
import { DEMO_CURRENCY, DEMO_PRODUCTS } from "@/features/marketing/demo/demo-shop"
import { Reveal } from "@/features/marketing/shared/reveal"
import { Section } from "@/features/marketing/shared/section"
import { buildOrderMessage } from "@/lib/whatsapp"
import { LinkCopyCard } from "./link-copy-card"
import { ThemePreviews } from "./theme-previews"

/** One feature row: text + visual, side by side from md (flipped when `reverse`). */
function Row({
  icon,
  title,
  body,
  visual,
  reverse = false,
  className,
}: {
  icon: ReactNode
  title: string
  body: string
  visual: ReactNode
  reverse?: boolean
  className?: string
}) {
  return (
    <Reveal>
      <div className={cn("grid items-center gap-8 md:grid-cols-2 md:gap-12", className)}>
        <div className={cn("flex flex-col gap-3", reverse && "md:order-2")}>
          <span className="flex size-12 items-center justify-center rounded-2xl bg-card text-plum shadow-soft">{icon}</span>
          <h3 className="font-heading text-2xl leading-tight font-extrabold tracking-tight md:text-3xl">{title}</h3>
          <p className="max-w-md text-base text-foreground/80 md:text-lg">{body}</p>
        </div>
        <div className={cn(reverse && "md:order-1")}>{visual}</div>
      </div>
    </Reveal>
  )
}

/** Home "Why Vano": three alternating rows with visuals drawn in code. */
export async function WhyVano() {
  const t = await getTranslations("Home")
  const tf = await getTranslations("Features")
  const tp = await getTranslations("Public")
  const td = await getTranslations("Demo")
  const locale = await getLocale()

  const product = DEMO_PRODUCTS[0]
  const message = buildOrderMessage(tp, {
    product: td(`products.${product.id}.name`),
    price: formatMoney(product.price, DEMO_CURRENCY, locale),
    size: "M",
    url: t("floatLinkUrl"),
  })

  const chat = (
    <div aria-hidden className="mx-auto w-full max-w-sm overflow-hidden rounded-3xl bg-card shadow-lift ring-1 ring-foreground/5 select-none">
      <div className="flex items-center gap-3 bg-whatsapp px-4 py-3 text-white">
        <span className="flex size-9 items-center justify-center rounded-full bg-white/20 text-sm font-bold">{t("chatCustomer").charAt(0)}</span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">{t("chatCustomer")}</p>
          <p className="text-xs text-white/80">{t("chatOnline")}</p>
        </div>
      </div>
      <div className="flex flex-col items-start gap-2 bg-muted p-4">
        {/* Received order (the seller's view). */}
        <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-card px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line text-foreground shadow-soft">
          {message}
          <span className="mt-1 block text-right text-xs text-muted-foreground">{t("chatTime")}</span>
        </div>
        {/* The customer is typing another message. */}
        <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-card px-3.5 py-3 shadow-soft">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="size-1.5 animate-typing rounded-full bg-muted-foreground motion-reduce:animate-none"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )

  const linkCard = (
    <LinkCopyCard url={t("floatLinkUrl")} label={t("linkCardLabel")} copyLabel={t("copyLink")} copiedLabel={t("floatCopied")} />
  )

  return (
    <Section eyebrow={t("highlightsEyebrow")} title={t("highlightsTitle")} className="bg-card/60">
      <div className="flex flex-col gap-16 md:gap-20">
        <Row
          className="rounded-3xl bg-blush p-6 md:grid-cols-[1fr_1.4fr] md:p-10"
          icon={<PaletteIcon className="size-6" aria-hidden />}
          title={tf("designTitle")}
          body={tf("designBody")}
          visual={<ThemePreviews />}
        />
        <Row
          reverse
          className="md:px-10"
          icon={<MessageCircleIcon className="size-6" aria-hidden />}
          title={tf("whatsappTitle")}
          body={t("whyWhatsappBody")}
          visual={chat}
        />
        <Row
          className="md:px-10"
          icon={<LinkIcon className="size-6" aria-hidden />}
          title={tf("linkTitle")}
          body={tf("linkBody")}
          visual={linkCard}
        />
      </div>
      <Link href="/features" className={buttonVariants({ variant: "outline", size: "lg", className: "w-full self-center sm:w-auto" })}>
        {t("seeAllFeatures")}
        <ArrowRightIcon aria-hidden />
      </Link>
    </Section>
  )
}
