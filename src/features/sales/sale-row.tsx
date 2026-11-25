"use client"

import { useMutation } from "convex/react"
import { CopyIcon, MoreVerticalIcon, PauseIcon, PencilIcon, PlayIcon, Trash2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "../../../convex/_generated/api"
import type { Currency } from "../../../convex/lib/money"
import { saleStatusAt } from "../../../convex/lib/sales/active"
import type { SellerSale } from "../../../convex/sales"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { StatusTag } from "@/components/data-table/status-tag"
import { useErrorMessage } from "@/lib/use-error-message"
import { useSaleLabels } from "./use-sale-labels"

export type SaleRowData = SellerSale & { products: number; overlaps: number; views: number; whatsappClicks: number }

/**
 * One slim row in the seller's list: name, status, discount, products,
 * dates, a short note when needed, and its actions menu. Without the plan feature
 * (`locked`) only pause and delete are offered.
 */
export function SaleRow({ sale, currency, now, locked }: { sale: SaleRowData; currency: Currency; now: number; locked: boolean }) {
  const t = useTranslations("Sales")
  const tc = useTranslations("Common")
  const labels = useSaleLabels(currency)
  const errorMessage = useErrorMessage()
  const router = useRouter()
  const pause = useMutation(api.sales.pause)
  const resume = useMutation(api.sales.resume)
  const duplicate = useMutation(api.sales.duplicate)
  const remove = useMutation(api.sales.remove)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, setPending] = useState(false)
  const status = saleStatusAt(sale, now)
  const paused = sale.paused || sale.adminPause !== null

  async function run(action: () => Promise<unknown>, done: string) {
    setPending(true)
    try {
      await action()
      toast.success(done)
      return true
    } catch (error) {
      toast.error(errorMessage(error))
      return false
    } finally {
      setPending(false)
    }
  }

  return (
    <li className="flex flex-col gap-1 py-1.5 ps-4 pe-1">
      <div className="flex items-center gap-3">
        {/* Phones: two lines; computers: one line (name + status | discount · products | dates). */}
        <div className="grid min-w-0 flex-1 gap-x-4 gap-y-0.5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.4fr)] md:items-center">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="min-w-0 truncate text-sm font-semibold">{sale.name}</h2>
            <StatusTag kind="sale" status={status} />
          </div>
          <p className="truncate text-sm tabular-nums">
            {labels.discount(sale.discount)} · {t("productCount", { count: sale.products })}
          </p>
          <p className="truncate text-xs text-muted-foreground">{labels.dates(sale.startsAt, sale.endsAt)}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label={t("actions", { name: sale.name })} disabled={pending} />}
          >
            <MoreVerticalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-48">
            {!locked ? (
              <DropdownMenuItem className="min-h-11" onClick={() => router.push(`/dashboard/offers/${sale._id}`)}>
                <PencilIcon /> {tc("edit")}
              </DropdownMenuItem>
            ) : null}
            {!locked ? (
              <DropdownMenuItem
                className="min-h-11"
                onClick={async () => {
                  setPending(true)
                  try {
                    const id = await duplicate({ saleId: sale._id, name: t("copyName", { name: sale.name }).slice(0, 60) })
                    toast.success(t("duplicated"))
                    router.push(`/dashboard/offers/${id}`)
                  } catch (error) {
                    toast.error(errorMessage(error))
                  } finally {
                    setPending(false)
                  }
                }}
              >
                <CopyIcon /> {t("duplicate")}
              </DropdownMenuItem>
            ) : null}
            {status !== "ended" && !paused ? (
              <DropdownMenuItem className="min-h-11" onClick={() => run(() => pause({ saleId: sale._id }), t("pausedToast"))}>
                <PauseIcon /> {t("pause")}
              </DropdownMenuItem>
            ) : null}
            {status !== "ended" && paused && !locked ? (
              <DropdownMenuItem className="min-h-11" onClick={() => run(() => resume({ saleId: sale._id }), t("resumedToast"))}>
                <PlayIcon /> {t("resume")}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="min-h-11 text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2Icon /> {tc("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {sale.adminPause ? (
        <p role="note" className="pe-3 pb-1 text-xs text-destructive">
          {t("adminPaused", { reason: sale.adminPause.reason })}
        </p>
      ) : null}
      {sale.overlaps > 0 && status !== "ended" ? (
        <p className="pe-3 pb-1 text-xs text-muted-foreground">{t("overlapRow", { count: sale.overlaps })}</p>
      ) : null}
      {sale.products === 0 ? <p className="pe-3 pb-1 text-xs text-tag-warning-foreground">{t("noProductsRow")}</p> : null}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogTitle>{t("deleteTitle")}</DialogTitle>
          <DialogDescription>{t("deleteBody", { name: sale.name })}</DialogDescription>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{tc("cancel")}</DialogClose>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={pending}
              onClick={async () => {
                if (await run(() => remove({ saleId: sale._id }), t("deleted"))) setConfirmDelete(false)
              }}
            >
              {pending ? tc("deleting") : tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  )
}
