"use client"

import { useQuery } from "convex/react"
import { ImageIcon, SearchIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useId, useState } from "react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { formatMoney, type Currency } from "../../../convex/lib/money"
import { LoadingState } from "@/components/states/states"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

/**
 * "Record a sale" on the Sales page, step 1: which product was sold.
 * Lists the seller's products (`products.listMine`), searchable; picking
 * one opens the same "Mark as sold" dialog as everywhere else.
 */
export function PickProductDialog({
  open,
  onOpenChange,
  currency,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currency: Currency
  onPick: (productId: Id<"products">) => void
}) {
  const t = useTranslations("SalesRecords.pick")
  const locale = useLocale()
  const id = useId()
  const products = useQuery(api.products.listMine, open ? {} : "skip")
  const [search, setSearch] = useState("")
  const needle = search.trim().toLowerCase()
  const shown = products?.filter((p) => needle === "" || p.name.toLowerCase().includes(needle)) ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden sm:max-w-lg">
        <DialogTitle>{t("title")}</DialogTitle>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id={id}
            type="search"
            aria-label={t("search")}
            placeholder={t("search")}
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="-mx-5 min-h-0 overflow-y-auto px-5">
          {products === undefined ? (
            <LoadingState />
          ) : products.length === 0 ? (
            <DialogDescription>{t("noProducts")}</DialogDescription>
          ) : shown.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {shown.map((p) => (
                <li key={p._id}>
                  <button
                    type="button"
                    onClick={() => onPick(p._id)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-md px-1 py-2 text-left hover:bg-muted focus-ring"
                  >
                    <span className="size-11 shrink-0 overflow-hidden rounded-md bg-muted">
                      {p.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
                        <img src={p.coverUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <span className="flex size-full items-center justify-center text-muted-foreground">
                          <ImageIcon className="size-4" aria-hidden />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {formatMoney(p.price, currency, locale)}
                        {p.soldOut ? ` · ${t("soldOut")}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
