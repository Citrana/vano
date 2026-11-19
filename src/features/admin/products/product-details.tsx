"use client"

import { useQuery } from "convex/react"
import { ImageIcon, PackageIcon } from "lucide-react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { api } from "../../../../convex/_generated/api"
import { formatMoney } from "../../../../convex/lib/money"
import { EmptyState, LoadingState } from "@/components/states/states"
import { Badge } from "@/components/ui/badge"
import { DetailItem, DetailList } from "../data-table/detail-list"
import { StatusTag } from "../data-table/status-tag"
import { closeDetailsDrawer } from "../data-table/use-table-state"
import { adminHref } from "../shell/hrefs"
import { useAdminViewer } from "../shell/use-admin-viewer"
import { ProductActions } from "./product-actions"

/** The product drawer: photo, price, shop, and view / hide / delete. */
export function ProductDetails({ productId }: { productId: string }) {
  const t = useTranslations("AdminProducts")
  const tc = useTranslations("Categories")
  const format = useFormatter()
  const locale = useLocale()
  const { viewer } = useAdminViewer()
  const product = useQuery(api.admin.products.get, { productId })

  if (product === undefined) return <LoadingState />
  if (product === null) return <EmptyState icon={<PackageIcon />} title={t("notFoundTitle")} body={t("notFoundBody")} />

  return (
    <>
      <div className="flex items-start gap-4">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
          {product.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
            <img src={product.coverUrl} alt="" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="font-heading text-lg font-bold break-words">{product.name}</p>
          <p className="text-base font-semibold tabular-nums">{formatMoney(product.price, product.shop.currency, locale)}</p>
          <div className="flex flex-wrap gap-1.5">
            <StatusTag kind="visibility" status={product.hidden ? "hidden" : "visible"} />
            {product.soldOut ? <Badge variant="muted">{t("soldOut")}</Badge> : null}
          </div>
        </div>
      </div>
      <DetailList className="rounded-xl border bg-card p-4">
        <DetailItem label={t("shop")}>
          <span className="flex flex-wrap items-center gap-2">
            {viewer?.permissions.includes("shops.view") ? (
              <Link href={adminHref.shop(product.shop._id)} className="font-medium hover:underline">
                {product.shop.name}
              </Link>
            ) : (
              product.shop.name
            )}
            {product.shop.status === "suspended" ? <StatusTag kind="shop" status="suspended" /> : null}
          </span>
        </DetailItem>
        <DetailItem label={t("category")}>{tc(product.category)}</DetailItem>
        <DetailItem label={t("added")}>{format.dateTime(new Date(product.createdAt), { dateStyle: "long" })}</DetailItem>
      </DetailList>
      <div className="flex items-center justify-end gap-1 border-t pt-3">
        <ProductActions
          product={{
            _id: product._id,
            name: product.name,
            hidden: product.hidden,
            shopSlug: product.shop.slug,
            shopActive: product.shop.status === "active",
          }}
          onDeleted={closeDetailsDrawer}
        />
      </div>
    </>
  )
}
