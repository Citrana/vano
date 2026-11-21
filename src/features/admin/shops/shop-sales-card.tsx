"use client"

import { useMutation, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useId, useState } from "react"
import { toast } from "sonner"
import { api } from "../../../../convex/_generated/api"
import type { Id } from "../../../../convex/_generated/dataModel"
import { RESET_REASON_MAX, RESET_REASON_MIN, resetReasonProblem } from "../../../../convex/lib/looks/reset"
import { saleStatusAt } from "../../../../convex/lib/sales/active"
import { LoadingState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useSaleLabels } from "@/features/sales/use-sale-labels"
import { useNow } from "@/features/shop-looks/editor/schedule-fields"
import { useErrorMessage } from "@/lib/use-error-message"
import { StatusTag } from "../data-table/status-tag"

type Action = "pause" | "remove"

/** Pause or delete one sale, with a required reason (logged, the seller is told). */
function ModerateSaleDialog({ saleId, name, action }: { saleId: Id<"sales">; name: string; action: Action }) {
  const t = useTranslations("AdminShops.sales")
  const tc = useTranslations("Common")
  const pause = useMutation(api.admin.sales.pause)
  const remove = useMutation(api.admin.sales.remove)
  const errorMessage = useErrorMessage()
  const reasonId = useId()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [pending, setPending] = useState(false)
  const invalid = resetReasonProblem(reason) !== null

  async function confirm() {
    setPending(true)
    try {
      await (action === "pause" ? pause : remove)({ saleId, reason })
      toast.success(action === "pause" ? t("pausedDone") : t("deletedDone"))
      setOpen(false)
      setReason("")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button variant={action === "pause" ? "outline" : "ghost"} size="sm" onClick={() => setOpen(true)}>
        {action === "pause" ? t("pause") : tc("delete")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{action === "pause" ? t("pauseTitle", { name }) : t("deleteTitle", { name })}</DialogTitle>
          <DialogDescription>{action === "pause" ? t("pauseBody") : t("deleteBody")}</DialogDescription>
          <div className="flex flex-col gap-2">
            <Label htmlFor={reasonId} required>
              {t("reason")}
            </Label>
            <Textarea
              id={reasonId}
              required
              value={reason}
              maxLength={RESET_REASON_MAX}
              onChange={(e) => setReason(e.target.value)}
              aria-describedby={`${reasonId}-help`}
            />
            <p id={`${reasonId}-help`} className="text-xs text-muted-foreground">
              {t("reasonHelp", { min: RESET_REASON_MIN, max: RESET_REASON_MAX })}
            </p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{tc("cancel")}</DialogClose>
            <Button variant="destructive" onClick={confirm} disabled={pending || invalid}>
              {action === "pause" ? t("pause") : tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * The shop drawer's sales card (CLAUDE.md "Sales"): every saved sale with
 * its status, discount, products and numbers; with `shops.manageSales`,
 * pause or delete with a reason (never on the admin's own shop).
 */
export function ShopSalesCard({ shopId, canManage, isOwnShop }: { shopId: Id<"shops">; canManage: boolean; isOwnShop: boolean }) {
  const t = useTranslations("AdminShops.sales")
  const ts = useTranslations("Sales")
  const now = useNow()
  const data = useQuery(api.admin.sales.listForShop, { shopId })
  const labels = useSaleLabels(data?.currency ?? "USD")

  if (data === undefined) return <LoadingState className="py-6" />
  if (data === null) return null
  return (
    <Card className="gap-4">
      <CardTitle className="text-base">{t("title")}</CardTitle>
      {data.sales.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {data.sales.map((sale) => {
            const status = saleStatusAt(sale, now)
            return (
              <li key={sale._id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{sale.name}</span>
                  <StatusTag kind="sale" status={status} />
                </div>
                <p className="text-sm">
                  {labels.discount(sale.discount)} · {ts("productCount", { count: sale.products })}
                </p>
                <p className="text-xs text-muted-foreground">{labels.dates(sale.startsAt, sale.endsAt)}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {ts("statsLine", { views: sale.views, clicks: sale.whatsappClicks })}
                </p>
                {sale.adminPause ? (
                  <p className="text-xs text-muted-foreground">{t("pausedBecause", { reason: sale.adminPause.reason })}</p>
                ) : null}
                {canManage && !isOwnShop ? (
                  <div className="flex flex-wrap gap-2">
                    {status === "running" || status === "scheduled" ? (
                      <ModerateSaleDialog saleId={sale._id} name={sale.name} action="pause" />
                    ) : null}
                    <ModerateSaleDialog saleId={sale._id} name={sale.name} action="remove" />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      {canManage && isOwnShop ? <p className="text-xs text-muted-foreground">{t("ownShop")}</p> : null}
    </Card>
  )
}
