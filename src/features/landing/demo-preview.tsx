import { ArrowUpRightIcon, MessageCircleIcon } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import { formatMoney } from "../../../convex/lib/money"
import { buttonVariants } from "@/components/ui/button"
import { demoShopPath } from "./config"
import { SAMPLE_CURRENCY, SAMPLE_PRODUCTS } from "./photos"
import { Reveal } from "./reveal"
import { Section } from "./section"

const cardClass =
  "group block h-full overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-foreground/5 transition-shadow outline-none"

export async function DemoPreview() {
  const t = await getTranslations("Landing")
  const locale = await getLocale()

  // One tap target per card; plain cards when no demo shop is configured.
  const card = (label: string, children: ReactNode) =>
    demoShopPath ? (
      <Link
        href={demoShopPath}
        aria-label={`${label} · ${t("demoOpen")}`}
        className={`${cardClass} hover:shadow-lift focus-visible:ring-3 focus-visible:ring-ring/50`}
      >
        {children}
      </Link>
    ) : (
      <div className={cardClass}>{children}</div>
    )

  return (
    <Section id="demo" eyebrow={t("demoEyebrow")} title={t("demoTitle")} subtitle={t("demoSubtitle")}>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
        {SAMPLE_PRODUCTS.map((p, i) => (
          <li key={p.key}>
            <Reveal delay={(i % 3) * 80} className="h-full">
              {card(
                t(p.key),
                <>
                  <div className="relative aspect-[4/5] bg-muted">
                    <Image
                      src={p.src}
                      alt={t(p.key)}
                      fill
                      sizes="(min-width: 1152px) 180px, (min-width: 1024px) 15vw, (min-width: 768px) 31vw, 46vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    <span
                      aria-hidden
                      className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-whatsapp px-2.5 py-1 text-sm font-semibold text-white shadow-soft"
                    >
                      <MessageCircleIcon className="size-4" />
                      {t("demoOrder")}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 p-3">
                    <p className="truncate text-base font-medium">{t(p.key)}</p>
                    <p className="text-base font-bold md:text-lg">{formatMoney(p.price, SAMPLE_CURRENCY, locale)}</p>
                  </div>
                </>,
              )}
            </Reveal>
          </li>
        ))}
      </ul>
      {demoShopPath ? (
        <Link
          href={demoShopPath}
          className={buttonVariants({ variant: "outline", size: "lg", className: "w-full self-center sm:w-auto" })}
        >
          {t("demoOpen")}
          <ArrowUpRightIcon aria-hidden />
        </Link>
      ) : null}
    </Section>
  )
}
