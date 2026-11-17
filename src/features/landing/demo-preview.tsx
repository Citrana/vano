import { ArrowUpRightIcon } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import Image from "next/image"
import Link from "next/link"
import { formatMoney } from "../../../convex/lib/money"
import { buttonVariants } from "@/components/ui/button"
import { demoShopPath } from "./config"
import { highlight } from "./highlight"
import { SAMPLE_CURRENCY, SAMPLE_PRODUCTS } from "./photos"
import { Reveal } from "./reveal"
import { Section } from "./section"

export async function DemoPreview() {
  const t = await getTranslations("Landing")
  const locale = await getLocale()
  return (
    <Section id="demo" eyebrow={t("demoEyebrow")} title={t.rich("demoTitle", highlight)} subtitle={t("demoSubtitle")}>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
        {SAMPLE_PRODUCTS.map((p, i) => (
          <li key={p.key}>
            <Reveal delay={(i % 3) * 80}>
              <div className="overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-foreground/5">
                <div className="relative aspect-[4/5] bg-muted">
                  <Image
                    src={p.src}
                    alt={t(p.key)}
                    fill
                    sizes="(min-width: 1152px) 180px, (min-width: 1024px) 15vw, (min-width: 768px) 31vw, 46vw"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-col gap-0.5 p-3">
                  <p className="truncate text-sm font-medium">{t(p.key)}</p>
                  <p className="font-bold">{formatMoney(p.price, SAMPLE_CURRENCY, locale)}</p>
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
      {demoShopPath ? (
        <Link href={demoShopPath} className={buttonVariants({ variant: "outline", size: "lg", className: "self-center" })}>
          {t("demoOpen")}
          <ArrowUpRightIcon aria-hidden />
        </Link>
      ) : null}
    </Section>
  )
}
