"use client"

import { ImageIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import type { Id } from "../../../../convex/_generated/dataModel"
import type { Category } from "../../../../convex/lib/catalog"
import { formatMoney, type Currency } from "../../../../convex/lib/money"
import { Badge } from "@/components/ui/badge"
import { useAdminViewer } from "../shell/use-admin-viewer"
import { ProductActions } from "./product-actions"

export type AdminProductRow = {
  _id: Id<"products">
  name: string
  price: number
  category: Category
  soldOut: boolean
  hidden: boolean
  coverUrl: string | null
  shop: { _id: Id<"shops">; name: string; slug: string; status: "active" | "suspended"; currency: Currency }
}

/** One responsive list (cover, name, shop, price, badges, actions) for phones and desktop. */
export function ProductsList({ rows }: { rows: AdminProductRow[] }) {
  const t = useTranslations("AdminProducts")
  const tc = useTranslations("Categories")
  const locale = useLocale()
  const { viewer } = useAdminViewer()
  const canOpenShop = viewer?.permissions.includes("shops.view") ?? false

  return (
    <ul className="flex flex-col divide-y overflow-hidden rounded-xl bg-card border">
      {rows.map((p) => (
        <li key={p._id} className="flex items-center gap-3 p-3">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
            {p.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
              <img src={p.coverUrl} alt="" className="size-full object-cover" />
            ) : (
              <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-4">
            <div className="flex min-w-0 flex-col md:w-2/5">
              <span className="truncate font-medium">{p.name}</span>
              {canOpenShop ? (
                <Link href={`/admin/shops/${p.shop._id}`} className="truncate text-xs text-muted-foreground hover:underline">
                  {p.shop.name}
                </Link>
              ) : (
                <span className="truncate text-xs text-muted-foreground">{p.shop.name}</span>
              )}
            </div>
            <span className="text-sm tabular-nums md:w-1/5">{formatMoney(p.price, p.shop.currency, locale)}</span>
            <div className="flex flex-wrap items-center gap-1 md:flex-1">
              <Badge variant="muted">{tc(p.category)}</Badge>
              {p.hidden ? <Badge variant="destructive">{t("hidden")}</Badge> : null}
              {p.soldOut ? <Badge variant="muted">{t("soldOut")}</Badge> : null}
              {p.shop.status === "suspended" ? <Badge variant="destructive">{t("shopSuspended")}</Badge> : null}
            </div>
          </div>
          <ProductActions
            product={{
              _id: p._id,
              name: p.name,
              hidden: p.hidden,
              shopSlug: p.shop.slug,
              shopActive: p.shop.status === "active",
            }}
          />
        </li>
      ))}
    </ul>
  )
}
