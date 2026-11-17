"use client"

import { usePaginatedQuery } from "convex/react"
import { ImageIcon, Loader2Icon, PackageIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { api } from "../../../../convex/_generated/api"
import type { Id } from "../../../../convex/_generated/dataModel"
import { formatMoney, type Currency } from "../../../../convex/lib/money"
import { EmptyState, LoadingState } from "@/components/states/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { ProductActions } from "../products/product-actions"

const PAGE_SIZE = 20

/** A shop's products (hidden ones included), with "Load more". */
export function ShopProducts({
  shopId,
  shopSlug,
  shopActive,
  currency,
  total,
}: {
  shopId: Id<"shops">
  shopSlug: string
  shopActive: boolean
  currency: Currency
  total: number
}) {
  const t = useTranslations("AdminShops")
  const tc = useTranslations("Categories")
  const locale = useLocale()
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.shops.products,
    { shopId },
    { initialNumItems: PAGE_SIZE },
  )

  return (
    <Card>
      <CardTitle>{t("productsTitle", { count: total })}</CardTitle>
      {status === "LoadingFirstPage" ? (
        <LoadingState className="py-6" />
      ) : results.length === 0 ? (
        <EmptyState icon={<PackageIcon />} title={t("noProducts")} className="py-8" />
      ) : (
        <>
          <ul className="flex flex-col divide-y">
            {results.map((p) => (
              <li key={p._id} className="flex items-center gap-3 py-2">
                <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {p.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
                    <img src={p.coverUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatMoney(p.price, currency, locale)} · {tc(p.category)}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {p.hidden ? <Badge variant="destructive">{t("hidden")}</Badge> : null}
                  {p.soldOut ? <Badge variant="muted">{t("soldOut")}</Badge> : null}
                </div>
                <ProductActions product={{ _id: p._id, name: p.name, hidden: p.hidden, shopSlug, shopActive }} />
              </li>
            ))}
          </ul>
          {status !== "Exhausted" ? (
            <Button variant="outline" className="self-center" disabled={status === "LoadingMore"} onClick={() => loadMore(PAGE_SIZE)}>
              {status === "LoadingMore" ? <Loader2Icon className="animate-spin" /> : null}
              {t("loadMore")}
            </Button>
          ) : null}
        </>
      )}
    </Card>
  )
}
