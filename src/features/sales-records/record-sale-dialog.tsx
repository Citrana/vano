"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "convex/react"
import { ImageIcon, MinusIcon, PlusIcon, TagIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useId, useRef, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { cn } from "cn"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { minorToInput } from "../../../convex/lib/money"
import { recordTotals } from "../../../convex/lib/salesRecords/pricing"
import { QUANTITY_MAX, QUANTITY_MIN } from "../../../convex/lib/salesRecords/rules"
import { SALE_SOURCES } from "../../../convex/lib/salesRecords/validators"
import { LoadingState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { RequiredFieldsHint } from "@/components/ui/required-fields-hint"
import { Switch } from "@/components/ui/switch"
import { useUpgradePlanName } from "@/features/billing/use-plan-catalog"
import { browserTimeZone, fromLocalInput, toLocalInput } from "@/lib/local-time"
import { useErrorMessage } from "@/lib/use-error-message"
import { clock, priceOf, recordSchema, type RecordFormValues } from "./schemas"
import { useRecordLabels } from "./use-record-labels"

/**
 * "Mark as sold" (CLAUDE.md "Sales tracking"): one confirmation dialog,
 * opened from the product list menu, the product page and the Sales page.
 * The price is prefilled from the server (`salesRecords.quote`: running
 * sale or a code, best for the customer) and stays editable; the server
 * checks everything again on "Confirm sale".
 */
export function RecordSaleDialog({
  productId,
  open,
  onOpenChange,
  onRecorded,
}: {
  productId: Id<"products"> | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRecorded?: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {/* Mounted per opening: a fresh clock and no code left from last time. */}
        {productId ? (
          <RecordSaleBody
            productId={productId}
            onDone={() => {
              onOpenChange(false)
              onRecorded?.()
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function RecordSaleBody({ productId, onDone }: { productId: Id<"products">; onDone: () => void }) {
  const t = useTranslations("SalesRecords.dialog")
  const plan = useUpgradePlanName("salesReports")
  // The clock the price is quoted at: fixed while the dialog is open.
  const [openedAt] = useState(clock)
  const [code, setCode] = useState<string | undefined>(undefined)
  const quote = useQuery(api.salesRecords.quote, { productId, code, now: openedAt })
  return (
    <>
      <DialogTitle>{t("title")}</DialogTitle>
      {quote === undefined ? (
        <LoadingState />
      ) : quote.locked ? (
        <DialogDescription>{t("locked", { plan })}</DialogDescription>
      ) : (
        <RecordSaleForm key={quote.product._id} quote={quote} openedAt={openedAt} code={code} onCode={setCode} onDone={onDone} />
      )}
    </>
  )
}

type Quote = Extract<NonNullable<ReturnType<typeof useQuery<typeof api.salesRecords.quote>>>, { locked: false }>

function RecordSaleForm({
  quote,
  openedAt,
  code,
  onCode,
  onDone,
}: {
  quote: Quote
  openedAt: number
  code: string | undefined
  onCode: (code: string | undefined) => void
  onDone: () => void
}) {
  const t = useTranslations("SalesRecords")
  const tv = useTranslations("SalesRecords.validation")
  const tc = useTranslations("Common")
  const id = useId()
  const errorMessage = useErrorMessage()
  const record = useMutation(api.salesRecords.record)
  const labels = useRecordLabels(quote.currency, quote.timeZone)
  const { product } = quote
  const [codeText, setCodeText] = useState(code ?? "")

  const form = useForm<RecordFormValues>({
    resolver: zodResolver(
      recordSchema(tv, {
        sizes: product.sizes,
        colors: product.colors,
        country: quote.country,
        timeZone: quote.timeZone,
        now: clock,
      }),
    ),
    defaultValues: {
      size: product.sizes.length === 1 ? product.sizes[0] : "",
      color: product.colors.length === 1 ? product.colors[0] : "",
      quantity: 1,
      price: minorToInput(quote.suggestedPrice),
      source: "whatsapp",
      customerName: "",
      customerPhone: "",
      soldAt: toLocalInput(openedAt, quote.timeZone),
      markSoldOut: quote.defaultMarkSoldOut && !product.soldOut,
    },
  })
  const { errors, isSubmitting } = form.formState

  // A newly applied code (or a removed one) changes the suggested price: prefill it again.
  const lastSuggested = useRef(quote.suggestedPrice)
  useEffect(() => {
    if (quote.suggestedPrice !== lastSuggested.current) {
      lastSuggested.current = quote.suggestedPrice
      form.setValue("price", minorToInput(quote.suggestedPrice), { shouldValidate: true })
    }
  }, [quote.suggestedPrice, form])

  const [quantity, price] = useWatch({ control: form.control, name: ["quantity", "price"] })
  const unit = priceOf(price)
  const totals =
    unit !== null && quantity >= QUANTITY_MIN && quantity <= QUANTITY_MAX
      ? recordTotals({ normalUnitPrice: product.price, finalUnitPrice: unit, quantity })
      : null

  async function submit(values: RecordFormValues) {
    try {
      await record({
        productId: product._id,
        size: values.size || undefined,
        color: values.color || undefined,
        quantity: values.quantity,
        finalUnitPrice: priceOf(values.price)!,
        code,
        source: values.source,
        customerName: values.customerName.trim() || undefined,
        customerPhone: values.customerPhone.trim() || undefined,
        soldAt: fromLocalInput(values.soldAt, quote.timeZone)!,
        markSoldOut: values.markSoldOut,
        timeZone: quote.hasTimeZone ? undefined : browserTimeZone(),
      })
      toast.success(values.markSoldOut ? t("dialog.recordedSoldOut") : t("dialog.recorded"))
      onDone()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const offerNote =
    quote.offer === null
      ? null
      : quote.offer.kind === "sale"
        ? t("dialog.offerSale", { percent: quote.offer.percent })
        : t("dialog.offerCode", { code: quote.offer.code, percent: quote.offer.percent })

  return (
    <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
      <div className="flex items-center gap-3">
        <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
          {product.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
            <img src={product.coverUrl} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageIcon className="size-5" aria-hidden />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{product.name}</p>
          <p className="text-xs text-muted-foreground tabular-nums">{t("dialog.normalPrice", { price: labels.money(product.price) })}</p>
        </div>
      </div>
      <RequiredFieldsHint />

      {product.sizes.length > 0 ? (
        <Controller
          control={form.control}
          name="size"
          render={({ field }) => (
            <ChipGroup
              label={t("dialog.size")}
              required
              options={product.sizes.map((s) => ({ value: s, label: s }))}
              value={field.value}
              onChange={field.onChange}
              error={errors.size?.message}
            />
          )}
        />
      ) : null}
      {product.colors.length > 0 ? (
        <Controller
          control={form.control}
          name="color"
          render={({ field }) => (
            <ChipGroup
              label={t("dialog.color")}
              required
              options={product.colors.map((c) => ({ value: c, label: c }))}
              value={field.value}
              onChange={field.onChange}
              error={errors.color?.message}
            />
          )}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
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
        <Field
          id={`${id}-price`}
          label={t("dialog.finalPrice")}
          required
          help={t("dialog.finalPriceHint")}
          error={errors.price?.message}
        >
          {(props) => <MoneyInput currency={quote.currency} {...props} {...form.register("price")} />}
        </Field>
      </div>
      {offerNote ? (
        <p role="status" className="-mt-2 flex items-center gap-1.5 text-xs font-medium">
          <TagIcon className="size-3.5" aria-hidden />
          {offerNote}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-code`}>{t("dialog.code")}</Label>
        <div className="flex gap-2">
          <Input
            id={`${id}-code`}
            value={codeText}
            onChange={(e) => setCodeText(e.target.value.toUpperCase())}
            autoComplete="off"
            className="uppercase"
            aria-describedby={`${id}-code-help`}
          />
          {code !== undefined ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCodeText("")
                onCode(undefined)
              }}
            >
              {t("dialog.codeRemove")}
            </Button>
          ) : (
            <Button type="button" variant="outline" disabled={codeText.trim() === ""} onClick={() => onCode(codeText.trim())}>
              {t("dialog.codeApply")}
            </Button>
          )}
        </div>
        <p id={`${id}-code-help`} className="text-xs text-muted-foreground" role={quote.codeStatus ? "status" : undefined}>
          {quote.codeStatus && quote.codeStatus !== "applied" ? t(`dialog.codeStatus.${quote.codeStatus}`) : t("dialog.codeHint")}
        </p>
      </div>

      <Controller
        control={form.control}
        name="source"
        render={({ field }) => (
          <ChipGroup
            label={t("dialog.source")}
            required
            options={SALE_SOURCES.map((s) => ({ value: s, label: t(`sources.${s}`) }))}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />

      <Field
        id={`${id}-date`}
        label={t("dialog.soldAt")}
        required
        help={t("dialog.timeZoneNote", { zone: quote.timeZone })}
        error={errors.soldAt?.message}
      >
        {(props) => <Input type="datetime-local" {...props} {...form.register("soldAt")} />}
      </Field>

      <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">{t("dialog.customer")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={`${id}-name`} label={t("dialog.customerName")} error={errors.customerName?.message}>
            {(props) => <Input autoComplete="off" {...props} {...form.register("customerName")} />}
          </Field>
          <Field id={`${id}-phone`} label={t("dialog.customerPhone")} error={errors.customerPhone?.message}>
            {(props) => <Input type="tel" inputMode="tel" autoComplete="off" {...props} {...form.register("customerPhone")} />}
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">{t("dialog.customerHint")}</p>
      </fieldset>

      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span id={`${id}-soldout`} className="text-sm font-medium">
            {t("dialog.markSoldOut")}
          </span>
          <span className="text-xs text-muted-foreground">
            {product.soldOut ? t("dialog.alreadySoldOut") : t("dialog.markSoldOutHint")}
          </span>
        </div>
        <Controller
          control={form.control}
          name="markSoldOut"
          render={({ field }) => (
            <Switch aria-labelledby={`${id}-soldout`} checked={field.value} onCheckedChange={field.onChange} disabled={product.soldOut} />
          )}
        />
      </div>

      <div className="flex items-baseline justify-between gap-3 border-t pt-3" aria-live="polite">
        <span className="text-sm font-medium">{t("dialog.total")}</span>
        <span className="text-right">
          <span className="block text-lg font-bold tabular-nums">{totals ? labels.money(totals.total) : "—"}</span>
          {totals && totals.discount > 0 ? (
            <span className="block text-xs text-muted-foreground tabular-nums">
              {t("dialog.discountLine", { amount: labels.money(totals.discount) })}
            </span>
          ) : null}
        </span>
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{tc("cancel")}</DialogClose>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("dialog.confirming") : t("dialog.confirm")}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Single-choice chips (size, colour, source), as a radio group. */
function ChipGroup({
  label,
  required,
  options,
  value,
  onChange,
  error,
}: {
  label: string
  required?: boolean
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  const id = useId()
  return (
    <div role="radiogroup" aria-labelledby={id} aria-invalid={Boolean(error)} className="flex flex-col gap-2">
      <Label id={id} required={required}>
        {label}
      </Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className="group flex min-h-11 items-center rounded-full focus-ring"
          >
            <span
              className={cn(
                "flex h-8 items-center rounded-full border px-3 text-sm font-medium whitespace-nowrap transition-colors",
                value === o.value ? "chip-selected" : "bg-card group-hover:bg-muted",
              )}
            >
              {o.label}
            </span>
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** − [n] + with 44px targets. */
export function QuantityField({
  id,
  label,
  value,
  onChange,
  error,
  decreaseLabel,
  increaseLabel,
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  error?: string
  decreaseLabel: string
  increaseLabel: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} required>
        {label}
      </Label>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11"
          aria-label={decreaseLabel}
          disabled={value <= QUANTITY_MIN}
          onClick={() => onChange(Math.max(QUANTITY_MIN, value - 1))}
        >
          <MinusIcon />
        </Button>
        <Input
          id={id}
          inputMode="numeric"
          className="w-16 text-center tabular-nums"
          value={Number.isFinite(value) ? String(value) : ""}
          aria-invalid={Boolean(error)}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 3)
            onChange(digits === "" ? Number.NaN : Number(digits))
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11"
          aria-label={increaseLabel}
          disabled={value >= QUANTITY_MAX}
          onClick={() => onChange(Math.min(QUANTITY_MAX, (Number.isFinite(value) ? value : 0) + 1))}
        >
          <PlusIcon />
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
