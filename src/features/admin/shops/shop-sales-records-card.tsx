"use client"

import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useId, useState } from "react"
import { toast } from "sonner"
import type { FunctionReturnType } from "convex/server"
import { api } from "../../../../convex/_generated/api"
import type { Id } from "../../../../convex/_generated/dataModel"
import { RESET_REASON_MAX, RESET_REASON_MIN, resetReasonProblem } from "../../../../convex/lib/looks/reset"
import { formatMoney } from "../../../../convex/lib/money"
import { formatWhatsapp } from "../../../../convex/lib/phone"
import { LoadingState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useErrorMessage } from "@/lib/use-error-message"
import { DetailItem, DetailList } from "@/components/data-table/detail-list"

type Customers = FunctionReturnType<typeof api.admin.salesRecords.revealCustomers>

/**
 * The shop drawer's recorded sales card (CLAUDE.md "Sales tracking"):
 * totals only. Customer names and phones need `shops.viewCustomers` and a
 * reason (logged in the activity history), never on the admin's own shop.
 * Revealed details live only in this card's state, gone when it closes.
 */
export function ShopSalesRecordsCard({
  shopId,
  canViewCustomers,
  isOwnShop,
}: {
  shopId: Id<"shops">
  canViewCustomers: boolean
  isOwnShop: boolean
}) {
  const t = useTranslations("AdminShops.salesRecords")
  const tr = useTranslations("SalesRecords")
  const locale = useLocale()
  const data = useQuery(api.admin.salesRecords.summaryForShop, { shopId })
  const [customers, setCustomers] = useState<Customers | null>(null)

  if (data === undefined) return <LoadingState className="py-6" />
  if (data === null) return null
  const money = (minor: number) => formatMoney(minor, data.currency, locale)
  const date = (ms: number) => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(ms)
  return (
    <Card className="gap-4">
      <CardTitle className="text-base">{t("title")}</CardTitle>
      {data.count === 0 && data.reversed === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <DetailList>
            <DetailItem label={t("sales")}>{data.count}</DetailItem>
            <DetailItem label={t("items")}>{data.items}</DetailItem>
            <DetailItem label={t("revenue")}>{money(data.revenue)}</DetailItem>
            <DetailItem label={t("discounts")}>{money(data.discounts)}</DetailItem>
          </DetailList>
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            {data.reversed > 0 ? <p>{t("reversed", { count: data.reversed })}</p> : null}
            {data.lastSoldAt !== null ? <p>{t("lastSale", { date: date(data.lastSoldAt) })}</p> : null}
            {data.truncated ? <p>{t("truncated", { count: data.count + data.reversed })}</p> : null}
          </div>
          {customers ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{t("revealed", { count: customers.length })}</p>
                <Button variant="ghost" size="sm" onClick={() => setCustomers(null)}>
                  {t("hide")}
                </Button>
              </div>
              {customers.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noCustomers")}</p>
              ) : (
                <ul className="flex flex-col divide-y text-sm">
                  {customers.map((c) => (
                    <li key={c._id} className="flex flex-col gap-0.5 py-2">
                      <span className="font-medium">{[c.customerName, c.customerPhone && formatWhatsapp(c.customerPhone)].filter(Boolean).join(" · ")}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.productName} · {tr(`sources.${c.source}`)} · {date(c.soldAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : canViewCustomers && !isOwnShop ? (
            <RevealDialog shopId={shopId} onRevealed={setCustomers} />
          ) : null}
        </>
      )}
    </Card>
  )
}

function RevealDialog({ shopId, onRevealed }: { shopId: Id<"shops">; onRevealed: (rows: Customers) => void }) {
  const t = useTranslations("AdminShops.salesRecords")
  const tm = useTranslations("AdminShops.moderate")
  const tc = useTranslations("Common")
  const id = useId()
  const errorMessage = useErrorMessage()
  const reveal = useMutation(api.admin.salesRecords.revealCustomers)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [pending, setPending] = useState(false)

  async function confirm() {
    setPending(true)
    try {
      onRevealed(await reveal({ shopId, reason }))
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
      <Button variant="outline" size="sm" className="self-start" onClick={() => setOpen(true)}>
        {t("reveal")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{t("revealTitle")}</DialogTitle>
          <DialogDescription>{t("revealBody")}</DialogDescription>
          <div className="flex flex-col gap-2">
            <Label htmlFor={id} required>
              {t("reason")}
            </Label>
            <Textarea
              id={id}
              required
              value={reason}
              maxLength={RESET_REASON_MAX}
              onChange={(e) => setReason(e.target.value)}
              aria-describedby={`${id}-help`}
            />
            <p id={`${id}-help`} className="text-xs text-muted-foreground">
              {tm("reasonHelp", { min: RESET_REASON_MIN, max: RESET_REASON_MAX })}
            </p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{tc("cancel")}</DialogClose>
            <Button onClick={confirm} disabled={pending || resetReasonProblem(reason) !== null}>
              {t("revealConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
