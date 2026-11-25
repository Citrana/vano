"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "convex/react"
import { ImageIcon, PencilIcon, Undo2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useId, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { minorToInput } from "../../../convex/lib/money"
import { recordTotals } from "../../../convex/lib/salesRecords/pricing"
import { formatWhatsapp } from "../../../convex/lib/phone"
import { LoadingState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Switch } from "@/components/ui/switch"
import { DetailItem, DetailList } from "@/components/data-table/detail-list"
import { StatusTag } from "@/components/data-table/status-tag"
import { fromLocalInput, toLocalInput } from "@/lib/local-time"
import { useErrorMessage } from "@/lib/use-error-message"
import { QuantityField } from "./record-sale-dialog"
import { clock, editSchema, priceOf, type EditFormValues } from "./schemas"
import { useRecordLabels } from "./use-record-labels"

type Details = NonNullable<ReturnType<typeof useQuery<typeof api.salesRecords.get>>>

/** One sale in the Sales page drawer: the snapshot, then Edit and Reverse. */
export function SaleDetails({ recordId }: { recordId: string }) {
  const t = useTranslations("SalesRecords")
  const sale = useQuery(api.salesRecords.get, { recordId })
  const [editing, setEditing] = useState(false)
  const [reversing, setReversing] = useState(false)
  if (sale === undefined) return <LoadingState />
  if (sale === null) return <p className="text-sm text-muted-foreground">{t("details.notFound")}</p>
  return (
    <>
      <SaleSummary sale={sale} />
      {sale.status === "recorded" ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => setEditing(true)}>
            <PencilIcon /> {t("details.edit")}
          </Button>
          <Button variant="ghost" onClick={() => setReversing(true)}>
            <Undo2Icon /> {t("details.reverse")}
          </Button>
        </div>
      ) : null}
      {editing ? <EditSaleDialog sale={sale} onClose={() => setEditing(false)} /> : null}
      <ReverseSaleDialog sale={sale} open={reversing} onOpenChange={setReversing} />
    </>
  )
}

function SaleSummary({ sale }: { sale: Details }) {
  const t = useTranslations("SalesRecords")
  const labels = useRecordLabels(sale.currency, sale.timeZone)
  const options = [sale.size, sale.color].filter(Boolean).join(" · ")
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
          {sale.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
            <img src={sale.photoUrl} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageIcon className="size-5" aria-hidden />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="truncate font-semibold">{sale.productName}</p>
          <StatusTag kind="salesRecord" status={sale.status} />
        </div>
      </div>
      {!sale.productExists ? <p className="text-xs text-muted-foreground">{t("details.productDeleted")}</p> : null}
      {sale.status === "reversed" && sale.reversedAt !== null ? (
        <p className="text-sm text-muted-foreground">{t("details.reversedOn", { date: labels.dateTime(sale.reversedAt) })}</p>
      ) : null}
      <DetailList>
        <DetailItem label={t("details.total")}>
          <span className="text-base font-bold tabular-nums">{labels.money(sale.total)}</span>
        </DetailItem>
        <DetailItem label={t("details.soldAt")}>{labels.dateTime(sale.soldAt)}</DetailItem>
        <DetailItem label={t("details.quantity")}>{sale.quantity}</DetailItem>
        <DetailItem label={t("details.unitPrice")}>{labels.money(sale.finalUnitPrice)}</DetailItem>
        <DetailItem label={t("details.normalPrice")}>{labels.money(sale.normalUnitPrice)}</DetailItem>
        <DetailItem label={t("details.discount")}>{sale.discount > 0 ? labels.money(sale.discount) : t("details.none")}</DetailItem>
        <DetailItem label={t("details.offer")}>{labels.offer(sale.offer)}</DetailItem>
        {options ? <DetailItem label={t("details.options")}>{options}</DetailItem> : null}
        <DetailItem label={t("details.source")}>{t(`sources.${sale.source}`)}</DetailItem>
        <DetailItem label={t("details.customer")}>
          {sale.customerName || sale.customerPhone ? (
            <span className="flex flex-col">
              {sale.customerName ? <span>{sale.customerName}</span> : null}
              {sale.customerPhone ? (
                <a href={`tel:${sale.customerPhone}`} className="underline underline-offset-2 tabular-nums focus-ring">
                  {formatWhatsapp(sale.customerPhone)}
                </a>
              ) : null}
            </span>
          ) : (
            <span className="text-muted-foreground">{t("details.noCustomer")}</span>
          )}
        </DetailItem>
      </DetailList>
      {sale.markedSoldOut ? <p className="text-xs text-muted-foreground">{t("details.markedSoldOut")}</p> : null}
    </div>
  )
}

/** Edit price / quantity / date, then a confirm step showing the new total. */
function EditSaleDialog({ sale, onClose }: { sale: Details; onClose: () => void }) {
  const t = useTranslations("SalesRecords")
  const tv = useTranslations("SalesRecords.validation")
  const tc = useTranslations("Common")
  const id = useId()
  const errorMessage = useErrorMessage()
  const update = useMutation(api.salesRecords.update)
  const labels = useRecordLabels(sale.currency, sale.timeZone)
  const [confirming, setConfirming] = useState<EditFormValues | null>(null)
  const [pending, setPending] = useState(false)
  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema(tv, { timeZone: sale.timeZone, now: clock })),
    defaultValues: {
      price: minorToInput(sale.finalUnitPrice),
      quantity: sale.quantity,
      soldAt: toLocalInput(sale.soldAt, sale.timeZone),
    },
  })
  const { errors } = form.formState
  const newTotal = confirming
    ? recordTotals({ normalUnitPrice: sale.normalUnitPrice, finalUnitPrice: priceOf(confirming.price)!, quantity: confirming.quantity }).total
    : 0

  async function save(values: EditFormValues) {
    setPending(true)
    try {
      await update({
        recordId: sale._id as Id<"salesRecords">,
        expectedVersion: sale.version,
        finalUnitPrice: priceOf(values.price)!,
        quantity: values.quantity,
        soldAt: fromLocalInput(values.soldAt, sale.timeZone)!,
      })
      toast.success(t("edit.saved"))
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        {confirming ? (
          <>
            <DialogTitle>{t("edit.confirmTitle")}</DialogTitle>
            <DialogDescription>{t("edit.confirmBody", { total: labels.money(newTotal) })}</DialogDescription>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(null)} disabled={pending}>
                {t("edit.back")}
              </Button>
              <Button onClick={() => save(confirming)} disabled={pending}>
                {t("edit.save")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={form.handleSubmit(setConfirming)} className="flex flex-col gap-4" noValidate>
            <DialogTitle>{t("edit.title")}</DialogTitle>
            <DialogDescription>{t("edit.body")}</DialogDescription>
            <Controller
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <QuantityField
                  id={`${id}-qty`}
                  label={t("dialog.quantity")}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.quantity?.message}
                  decreaseLabel={t("dialog.decrease")}
                  increaseLabel={t("dialog.increase")}
                />
              )}
            />
            <Field id={`${id}-price`} label={t("dialog.finalPrice")} required error={errors.price?.message}>
              {(props) => <MoneyInput currency={sale.currency} {...props} {...form.register("price")} />}
            </Field>
            <Field
              id={`${id}-date`}
              label={t("dialog.soldAt")}
              required
              help={t("dialog.timeZoneNote", { zone: sale.timeZone })}
              error={errors.soldAt?.message}
            >
              {(props) => <Input type="datetime-local" {...props} {...form.register("soldAt")} />}
            </Field>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>{tc("cancel")}</DialogClose>
              <Button type="submit">{t("edit.save")}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Reverse = kept and listed, out of the totals; may put the product back on sale. */
function ReverseSaleDialog({ sale, open, onOpenChange }: { sale: Details; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("SalesRecords.reverse")
  const tc = useTranslations("Common")
  const id = useId()
  const errorMessage = useErrorMessage()
  const reverse = useMutation(api.salesRecords.reverse)
  const [restock, setRestock] = useState(true)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setPending(true)
    try {
      const withRestock = sale.canRestock && restock
      await reverse({ recordId: sale._id as Id<"salesRecords">, expectedVersion: sale.version, restock: withRestock })
      toast.success(withRestock ? t("doneRestocked") : t("done"))
      onOpenChange(false)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("body")}</DialogDescription>
        {sale.canRestock ? (
          <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="flex flex-col gap-0.5">
              <span id={`${id}-restock`} className="text-sm font-medium">
                {t("restock")}
              </span>
              <span className="text-xs text-muted-foreground">{t("restockHint")}</span>
            </div>
            <Switch aria-labelledby={`${id}-restock`} checked={restock} onCheckedChange={setRestock} />
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{tc("cancel")}</DialogClose>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
