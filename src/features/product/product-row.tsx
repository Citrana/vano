"use client"

import { useMutation } from "convex/react"
import { ImageIcon, PencilIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { toast } from "sonner"
import { cn } from "cn"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import type { Category } from "../../../convex/lib/catalog"
import { formatMoney, type Currency } from "../../../convex/lib/money"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useErrorMessage } from "@/lib/use-error-message"
import { DeleteProductDialog } from "./delete-product-dialog"

export type ProductRowData = {
  _id: Id<"products">
  name: string
  price: number
  category: Category
  soldOut: boolean
  coverUrl: string | null
}

export function ProductRow({
  product,
  currency,
  stats,
}: {
  product: ProductRowData
  currency: Currency
  stats?: { views: number; whatsappClicks: number }
}) {
  const t = useTranslations("Dashboard")
  const tc = useTranslations("Categories")
  const tCommon = useTranslations("Common")
  const locale = useLocale()
  const setSoldOut = useMutation(api.products.setSoldOut).withOptimisticUpdate((store, { productId, soldOut }) => {
    const list = store.getQuery(api.products.listMine, {})
    if (list) {
      store.setQuery(
        api.products.listMine,
        {},
        list.map((p) => (p._id === productId ? { ...p, soldOut } : p)),
      )
    }
  })
  const errorMessage = useErrorMessage()
  const switchLabelId = `sold-out-${product._id}`

  return (
    <li className="flex gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
      <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-24">
        {product.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
          <img src={product.coverUrl} alt="" className={cn("size-full object-cover", product.soldOut && "grayscale")} />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageIcon className="size-6" aria-hidden />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{product.name}</p>
            <p className="text-sm font-semibold tabular-nums">{formatMoney(product.price, currency, locale)}</p>
          </div>
          <div className="-mt-1 -mr-1 flex shrink-0">
            <Link
              href={`/dashboard/products/${product._id}`}
              className={buttonVariants({ variant: "ghost", size: "icon" })}
              aria-label={`${tCommon("edit")}: ${product.name}`}
            >
              <PencilIcon />
            </Link>
            <DeleteProductDialog productId={product._id} name={product.name} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <Badge variant="muted">{tc(product.category)}</Badge>
          {product.soldOut ? <Badge variant="destructive">{t("soldOut")}</Badge> : null}
          {stats ? (
            <span>
              {t("views", { count: stats.views })} · {t("clicks", { count: stats.whatsappClicks })}
            </span>
          ) : null}
        </div>
        <div className="mt-auto flex items-center gap-2 self-start">
          <Switch
            aria-labelledby={switchLabelId}
            checked={product.soldOut}
            onCheckedChange={(soldOut) =>
              setSoldOut({ productId: product._id, soldOut }).catch((error) => toast.error(errorMessage(error)))
            }
          />
          <span id={switchLabelId} className="text-sm">
            {t("markSoldOut")}
          </span>
        </div>
      </div>
    </li>
  )
}
