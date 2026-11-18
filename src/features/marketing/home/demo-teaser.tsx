import { ArrowRightIcon } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import Image from "next/image"
import Link from "next/link"
import { formatMoney } from "../../../../convex/lib/money"
import { buttonVariants } from "@/components/ui/button"
import { DEMO_CURRENCY, DEMO_PRODUCTS, DEMO_SLUG } from "@/features/marketing/demo/demo-shop"
import { Reveal } from "@/features/marketing/shared/reveal"
import { Section } from "@/features/marketing/shared/section"

const TEASER = [DEMO_PRODUCTS[1], DEMO_PRODUCTS[2], DEMO_PRODUCTS[4], DEMO_PRODUCTS[5]]

/** A small row of demo products and a button to the demo shop. */
export async function DemoTeaser() {
  const t = await getTranslations("Home")
  const td = await getTranslations("Demo")
  const locale = await getLocale()
  return (
    <Section eyebrow={t("demoTeaserEyebrow")} title={t("demoTeaserTitle")} className="bg-card/60 pt-14 pb-14 md:pt-20 md:pb-20">
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:gap-6">
        {TEASER.map((p, i) => {
          const name = td(`products.${p.id}.name`)
          return (
            <li key={p.id}>
              <Reveal delay={i * 80} className="h-full">
                <Link
                  href={`/${DEMO_SLUG}/${p.id}`}
                  className="group block h-full overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-foreground/5 outline-none transition-shadow hover:shadow-lift focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <div className="relative aspect-[4/5] bg-muted">
                    <Image
                      src={p.photos[0]}
                      alt={name}
                      fill
                      sizes="(min-width: 1152px) 270px, (min-width: 768px) 23vw, 46vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5 p-3">
                    <p className="truncate text-base font-medium">{name}</p>
                    <p className="text-base font-bold tabular-nums">{formatMoney(p.price, DEMO_CURRENCY, locale)}</p>
                  </div>
                </Link>
              </Reveal>
            </li>
          )
        })}
      </ul>
      <Link href="/demo" className={buttonVariants({ variant: "outline", size: "lg", className: "w-full self-center sm:w-auto" })}>
        {t("seeTheDemoShop")}
        <ArrowRightIcon aria-hidden />
      </Link>
    </Section>
  )
}
