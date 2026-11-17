import { getLocale, getTranslations } from "next-intl/server"
import Image from "next/image"
import { formatMoney } from "../../../convex/lib/money"
import { SAMPLE_CURRENCY, SAMPLE_PRODUCTS } from "./photos"

/**
 * A phone frame showing a sample Vano shop page (drawn in CSS, real
 * product photos). The chips and order button are decorative.
 */
export async function PhoneMockup() {
  const t = await getTranslations("Landing")
  const lang = await getLocale()
  const products = SAMPLE_PRODUCTS.slice(0, 4)
  const chips = [t("mockupAll"), t("mockupClothes"), t("mockupBags"), t("mockupShoes")]

  return (
    <figure
      aria-label={t("mockupLabel")}
      className="relative w-[280px] rounded-[2.75rem] bg-ink p-2.5 text-left shadow-lift sm:w-[320px] md:w-[360px] lg:w-[380px]"
    >
      <div className="relative overflow-hidden rounded-[2.25rem] bg-background">
        <div aria-hidden className="absolute top-2.5 left-1/2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-ink" />
        <div className="flex flex-col gap-3 px-3.5 pt-12 pb-4 md:gap-4 md:px-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blush text-base font-extrabold text-plum">
              A
            </span>
            <div className="min-w-0 leading-tight">
              <p className="text-base font-bold">{t("mockupShop")}</p>
              <p className="truncate text-sm text-muted-foreground">{t("mockupTagline")}</p>
            </div>
          </div>
          <div aria-hidden className="flex gap-1.5 overflow-hidden">
            {chips.map((chip, i) => (
              <span
                key={chip}
                className={
                  (i === 0 ? "chip-selected font-semibold" : "bg-card font-medium") +
                  " shrink-0 rounded-full border px-3 py-1 text-xs sm:text-sm"
                }
              >
                {chip}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {products.map((p, i) => (
              <div key={p.key} className="overflow-hidden rounded-xl bg-card shadow-soft">
                <div className="relative aspect-[4/5] bg-muted">
                  <Image
                    src={p.src}
                    alt={t(p.key)}
                    fill
                    sizes="(min-width: 1024px) 170px, (min-width: 768px) 160px, (min-width: 640px) 140px, 124px"
                    className="object-cover"
                    {...(i === 0 ? { fetchPriority: "high" as const, loading: "eager" as const } : {})}
                  />
                </div>
                <div className="px-2.5 py-2 leading-tight">
                  <p className="truncate text-sm font-medium">{t(p.key)}</p>
                  <p className="text-sm font-bold">{formatMoney(p.price, SAMPLE_CURRENCY, lang)}</p>
                </div>
              </div>
            ))}
          </div>
          <span aria-hidden className="mt-1 rounded-xl bg-whatsapp py-2.5 text-center text-sm font-semibold text-white">
            {t("mockupOrder")}
          </span>
        </div>
      </div>
    </figure>
  )
}
