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
      className="relative w-[248px] rounded-[2.5rem] text-left bg-ink p-2.5 shadow-lift md:w-[300px]"
    >
      <div className="relative overflow-hidden rounded-[2rem] bg-background">
        <div aria-hidden className="absolute top-2 left-1/2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-ink" />
        <div className="flex flex-col gap-3 px-3 pt-10 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-full bg-blush text-sm font-extrabold text-plum">
              A
            </span>
            <div className="min-w-0 leading-tight">
              <p className="text-sm font-bold">{t("mockupShop")}</p>
              <p className="truncate text-[11px] text-muted-foreground">{t("mockupTagline")}</p>
            </div>
          </div>
          <div aria-hidden className="flex gap-1.5 overflow-hidden">
            {chips.map((chip, i) => (
              <span
                key={chip}
                className={
                  i === 0
                    ? "chip-selected rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                    : "rounded-full border bg-card px-2.5 py-1 text-[10px] font-medium"
                }
              >
                {chip}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {products.map((p, i) => (
              <div key={p.key} className="overflow-hidden rounded-xl bg-card shadow-soft">
                <div className="relative aspect-[4/5] bg-muted">
                  <Image
                    src={p.src}
                    alt={t(p.key)}
                    fill
                    sizes="(min-width: 768px) 136px, 112px"
                    className="object-cover"
                    {...(i === 0 ? { fetchPriority: "high" as const, loading: "eager" as const } : {})}
                  />
                </div>
                <div className="px-2 py-1.5 leading-tight">
                  <p className="truncate text-[10px] font-medium">{t(p.key)}</p>
                  <p className="text-[11px] font-bold">{formatMoney(p.price, SAMPLE_CURRENCY, lang)}</p>
                </div>
              </div>
            ))}
          </div>
          <span aria-hidden className="mt-1 rounded-lg bg-whatsapp py-2 text-center text-[11px] font-semibold text-white">
            {t("mockupOrder")}
          </span>
        </div>
      </div>
    </figure>
  )
}
