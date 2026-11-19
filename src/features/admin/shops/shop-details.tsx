"use client"

import { useQuery } from "convex/react"
import { ExternalLinkIcon, StoreIcon } from "lucide-react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { api } from "../../../../convex/_generated/api"
import type { Permission } from "../../../../convex/lib/permissions"
import { EmptyState, LoadingState } from "@/components/states/states"
import { Card, CardTitle } from "@/components/ui/card"
import { countryName } from "@/features/shop/countries"
import { ShopPlanPanel } from "../billing/shop-plan-panel"
import { DetailItem, DetailList } from "../data-table/detail-list"
import { StatusTag } from "../data-table/status-tag"
import { adminHref } from "../shell/hrefs"
import { useAdminViewer } from "../shell/use-admin-viewer"
import { DeleteShopDialog } from "./delete-shop-dialog"
import { ShopLookCard } from "./shop-look-card"
import { ShopProducts } from "./shop-products"
import { SuspendShopDialog } from "./suspend-shop-dialog"

/** The shop drawer: details, plan, products, and the actions the viewer may take. */
export function ShopDetails({ shopId }: { shopId: string }) {
  const t = useTranslations("AdminShops")
  const tcat = useTranslations("Categories")
  const tlang = useTranslations("Languages")
  const format = useFormatter()
  const locale = useLocale()
  const { viewer } = useAdminViewer()
  const shop = useQuery(api.admin.shops.get, { shopId })

  if (shop === undefined || !viewer) return <LoadingState />
  if (shop === null) return <EmptyState icon={<StoreIcon />} title={t("notFoundTitle")} body={t("notFoundBody")} />

  const can = (p: Permission) => viewer.permissions.includes(p)

  return (
    <div className="flex flex-col gap-4">
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
              <StatusTag kind="shop" status={shop.status} />
            </span>
          </div>
        </div>
        {shop.description ? <p className="text-sm text-muted-foreground">{shop.description}</p> : null}
        <DetailList>
          <DetailItem label={t("owner")}>
            {can("users.view") ? (
              <Link href={adminHref.user(shop.owner._id)} className="font-medium hover:underline">{shop.owner.email}</Link>
            ) : (
              shop.owner.email
            )}
          </DetailItem>
          <DetailItem label={t("whatsapp")}>{shop.whatsappNumber}</DetailItem>
          <DetailItem label={t("place")}>{`${shop.city}, ${countryName(shop.country, locale)}`}</DetailItem>
          <DetailItem label={t("currency")}>{shop.currency}</DetailItem>
          <DetailItem label={t("language")}>{tlang(shop.language)}</DetailItem>
          <DetailItem label={t("categories")}>{shop.categories.map((c) => tcat(c)).join(", ")}</DetailItem>
          <DetailItem label={t("created")}>{format.dateTime(new Date(shop.createdAt), { dateStyle: "long" })}</DetailItem>
        </DetailList>
      </Card>

      {can("billing.view") ? (
        <ShopPlanPanel
          shopId={shop._id}
          shopName={shop.name}
          canManage={can("billing.manage")}
          // A hint only: the server refuses it anyway (CANNOT_MODIFY_SELF).
          isOwnShop={viewer.email !== null && shop.owner.email === viewer.email}
        />
      ) : null}

      <ShopLookCard
        shopId={shop._id}
        name={shop.name}
        canReset={can("shops.resetLook")}
        // A hint only: the server refuses it anyway (CANNOT_MODIFY_SELF).
        isOwnShop={viewer.email !== null && shop.owner.email === viewer.email}
      />

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
