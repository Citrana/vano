import { EyeIcon, MessageCircleIcon, PencilIcon } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import Image from "next/image"
import { cn } from "cn"
import { formatMoney } from "../../../../convex/lib/money"
import { DEMO_CURRENCY, DEMO_PRODUCTS } from "@/features/marketing/demo/demo-shop"

const ROWS = [
  { product: DEMO_PRODUCTS[0], soldOut: false },
  { product: DEMO_PRODUCTS[3], soldOut: false },
  { product: DEMO_PRODUCTS[7], soldOut: true },
]

/**
 * Mock of the seller dashboard with the real actions only: edit and the
 * sold-out switch, plus shop views and WhatsApp clicks (sample numbers).
 */
export async function DashboardMock() {
  const t = await getTranslations("Features")
  const td = await getTranslations("Demo")
  const locale = await getLocale()
  return (
    <div aria-hidden className="mx-auto w-full max-w-md overflow-hidden rounded-xl bg-card border shadow-float select-none">
      <div className="grid grid-cols-2 gap-3 border-b bg-background p-4">
        {[
          { icon: EyeIcon, label: t("mockViews"), value: "128" },
          { icon: MessageCircleIcon, label: t("mockClicks"), value: "24" },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex flex-col gap-1 rounded-lg border bg-card p-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Icon className="size-3.5" />
              {label}
            </span>
            <span className="font-heading text-2xl font-extrabold tabular-nums">{value}</span>
          </div>
        ))}
        <p className="col-span-2 -mt-1 text-right text-[11px] text-muted-foreground">{t("mockSample")}</p>
      </div>
      <ul className="divide-y">
        {ROWS.map(({ product, soldOut }) => (
          <li key={product.id} className="flex items-center gap-3 px-4 py-3">
            <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
              <Image src={product.photos[0]} alt="" fill sizes="48px" className={cn("object-cover", soldOut && "grayscale")} />
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold">{td(`products.${product.id}.name`)}</p>
              <p className="text-sm text-muted-foreground tabular-nums">{formatMoney(product.price, DEMO_CURRENCY, locale)}</p>
            </div>
            <span className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
              <span className={cn("relative inline-flex h-5 w-9 items-center rounded-full", soldOut ? "bg-foreground" : "bg-input")}>
                <span className={cn("absolute left-0.5 size-4 rounded-full bg-white shadow", soldOut && "translate-x-4")} />
              </span>
              {t("mockSoldOut")}
            </span>
            <span className="inline-flex h-9 items-center gap-1 rounded-lg border border-border-strong px-2.5 text-xs font-semibold">
              <PencilIcon className="size-3.5" />
              {t("mockEdit")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
