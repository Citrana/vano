"use client"

import { useQuery } from "convex/react"
import { ExternalLinkIcon, StoreIcon } from "lucide-react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { api } from "../../../../convex/_generated/api"
import type { Permission } from "../../../../convex/lib/permissions"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, LoadingState } from "@/components/states/states"
import { Card, CardTitle } from "@/components/ui/card"
import { countryName } from "@/features/shop/countries"
import { useAdminViewer } from "../shell/use-admin-viewer"
import { DeleteShopDialog } from "./delete-shop-dialog"
import { ShopProducts } from "./shop-products"
import { ShopStatusBadge } from "./shop-status-badge"
import { SuspendShopDialog } from "./suspend-shop-dialog"

/** /admin/shops/[shopId]: details, products, and the actions the viewer may take. */
export function ShopDetails({ shopId }: { shopId: string }) {
  const t = useTranslations("AdminShops")
  const tcat = useTranslations("Categories")
  const tlang = useTranslations("Languages")
  const format = useFormatter()
  const locale = useLocale()
  const { viewer } = useAdminViewer()
  const shop = useQuery(api.admin.shops.get, { shopId })

  const header = <PageTitle title={shop?.name ?? t("detailsTitle")} backHref="/admin/shops" backLabel={t("back")} />
  if (shop === undefined || !viewer) return <>{header}<LoadingState /></>
  if (shop === null) {
    return <>{header}<EmptyState icon={<StoreIcon />} title={t("notFoundTitle")} body={t("notFoundBody")} /></>
  }

  const can = (p: Permission) => viewer.permissions.includes(p)
  const item = (label: string, value: React.ReactNode) => (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {header}
      <Card>
        <div className="flex items-center gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
            {shop.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
              <img src={shop.logoUrl} alt="" className="size-full object-cover" />
            ) : (
              <StoreIcon className="size-6 text-muted-foreground" aria-hidden />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="truncate">{shop.name}</CardTitle>
            <span className="flex flex-wrap items-center gap-2 text-sm">
              <a href={`/${shop.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                /{shop.slug}
                <ExternalLinkIcon className="size-3.5" aria-hidden />
              </a>
              <ShopStatusBadge status={shop.status} />
            </span>
          </div>
        </div>
        {shop.description ? <p className="text-sm text-muted-foreground">{shop.description}</p> : null}
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {item(
            t("owner"),
            can("users.view") ? (
              <Link href={`/admin/users/${shop.owner._id}`} className="font-medium hover:underline">{shop.owner.email}</Link>
            ) : (
              shop.owner.email
            ),
          )}
          {item(t("whatsapp"), shop.whatsappNumber)}
          {item(t("place"), `${shop.city}, ${countryName(shop.country, locale)}`)}
          {item(t("currency"), shop.currency)}
          {item(t("language"), tlang(shop.language))}
          {item(t("categories"), shop.categories.map((c) => tcat(c)).join(", "))}
          {item(t("created"), format.dateTime(new Date(shop.createdAt), { dateStyle: "long" }))}
        </dl>
      </Card>

      {can("shops.suspend") || can("shops.delete") ? (
        <Card>
          <CardTitle>{t("actions")}</CardTitle>
          {can("shops.suspend") ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {shop.status === "active" ? t("suspendHint") : t("reactivateHint")}
              </p>
              <SuspendShopDialog shopId={shop._id} name={shop.name} status={shop.status} />
            </div>
          ) : null}
          {can("shops.delete") ? (
            <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">{t("deleteHint")}</p>
              <DeleteShopDialog shopId={shop._id} name={shop.name} slug={shop.slug} />
            </div>
          ) : null}
        </Card>
      ) : null}

      <ShopProducts
        shopId={shop._id}
        shopSlug={shop.slug}
        shopActive={shop.status === "active"}
        currency={shop.currency}
        total={shop.productCount}
      />
    </div>
  )
}
