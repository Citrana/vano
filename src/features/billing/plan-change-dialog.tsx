"use client"

import { useMutation, useQuery } from "convex/react"
import { CheckIcon, PauseCircleIcon, ShieldCheckIcon } from "lucide-react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import { cn } from "cn"
import { api } from "../../../convex/_generated/api"
import { hasImpact, type DowngradeImpact } from "../../../convex/lib/downgradeImpact"
import type { PlanCatalog } from "../../../convex/lib/planCatalog"
import { GRACE_DAYS, PERIOD_DAYS, isPaidPlan, type PlanId } from "../../../convex/lib/plans"
import {
  effectivePlan,
  graceEndOf,
  paidDaysLeft,
  planChangeKind,
  quotePurchase,
  stateAt,
  type PlanPrices,
  type SubscriptionState,
} from "../../../convex/lib/subscriptions"
import { LoadingState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { addedFeatures, formatPlanPrice } from "@/features/marketing/pricing/plans"
import { useErrorMessage } from "@/lib/use-error-message"
import type { MyBilling } from "./use-billing"
import { usePlanName } from "./use-plan-catalog"

/** How many unlocks the upgrade dialog lists. */
const UNLOCKS_MAX = 4

export function billingState(billing: MyBilling): SubscriptionState {
  return {
    plan: billing.plan,
    status: billing.status,
    periodStart: billing.periodStart,
    periodEnd: billing.periodEnd,
    paidStart: billing.paidStart,
    paidEnd: billing.paidEnd,
  }
}

export function catalogPrices(catalog: PlanCatalog): PlanPrices {
  return Object.fromEntries(catalog.plans.map((p) => [p.id, p.monthlyMinor])) as PlanPrices
}

/**
 * The one plan change dialog (CLAUDE.md "Billing"). The mode comes from
 * the shared rules (`planChangeKind` / `quotePurchase`), so what it shows
 * is what the server charges and applies:
 * - upgrade: what the plan unlocks, the price (minus any credit), 30 days
 *   from today and the exact end date, then "Pay … with M-Pesa";
 * - renew: "Extend <plan> for 30 days" with the new end date;
 * - downgrade: nothing is charged and nothing changes now; the current
 *   plan runs to its end, and what will pause comes from the shop's data.
 * Every mode shows the amount and the end date.
 */
export function PlanChangeDialog({
  billing,
  catalog,
  target,
  now,
  onClose,
}: {
  billing: MyBilling
  catalog: PlanCatalog
  target: PlanId | null
  now: number
  onClose: () => void
}) {
  const state = stateAt(billingState(billing), now)
  const kind = target === null ? null : planChangeKind(state, target, now)
  return (
    <Dialog open={target !== null && kind !== null && kind !== "current"} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {target === null || kind === null || kind === "current" ? null : kind === "downgrade" ? (
          <DowngradeBody state={state} target={target} catalog={catalog} now={now} onClose={onClose} />
        ) : isPaidPlan(target) ? (
          <PurchaseBody billing={billing} state={state} target={target} catalog={catalog} now={now} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function useLongDate() {
  const format = useFormatter()
  return (ms: number) => format.dateTime(new Date(ms), { dateStyle: "long" })
}

function PurchaseBody({
  billing,
  state,
  target,
  catalog,
  now,
  onClose,
}: {
  billing: MyBilling
  state: SubscriptionState
  target: "pro" | "business"
  catalog: PlanCatalog
  now: number
  onClose: () => void
}) {
  const t = useTranslations("Billing.change")
  const planName = usePlanName()
  const locale = useLocale()
  const date = useLongDate()
  const router = useRouter()
  const errorMessage = useErrorMessage()
  const startCheckout = useMutation(api.billing.startCheckout)
  const [pending, setPending] = useState(false)

  const prices = catalogPrices(catalog)
  const quote = quotePurchase(state, target, now, prices)
  const price = prices[target] ?? 0
  const amount = formatPlanPrice(quote.amountMinor, locale)
  const end = quote.next.periodEnd ?? now
  const from = effectivePlan(state)
  const name = planName(target)
  const trialing = state.status === "trialing"
  const isRenew = quote.kind === "renew"
  const unlocks = isRenew ? [] : addedFeatures(catalog, from, target, locale).slice(0, UNLOCKS_MAX)

  async function pay() {
    setPending(true)
    try {
      const paymentId = await startCheckout({ plan: target })
      router.push(`/dashboard/billing/checkout/${paymentId}`)
    } catch (error) {
      toast.error(errorMessage(error))
      setPending(false)
    }
  }

  return (
    <>
      <DialogTitle>{isRenew ? t("renewTitle", { plan: name, days: PERIOD_DAYS }) : t("upgradeTitle", { plan: name })}</DialogTitle>
      <DialogDescription>{isRenew ? t("renewBody", { plan: name, days: PERIOD_DAYS }) : t(`benefit.${target}`)}</DialogDescription>

      {unlocks.length > 0 ? (
        <section aria-labelledby="unlocks-title" className="flex flex-col gap-2">
          <h3 id="unlocks-title" className="text-sm font-semibold">
            {t("unlocksTitle")}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {unlocks.map((f) => (
              <li key={f.key} className="flex items-start gap-2">
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={3} aria-hidden />
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!isRenew && from !== "free" ? (
        <p className="rounded-lg bg-secondary p-3">
          {t("includes", { plan: name, current: planName(from) })}
          {trialing ? ` ${t("trialEnds", { plan: name })}` : null}
        </p>
      ) : null}

      <Summary
        rows={[
          { label: t("price"), value: t("pricePer", { price: formatPlanPrice(price, locale), days: PERIOD_DAYS }) },
          ...(quote.creditMinor > 0
            ? [
                {
                  label: t("credit", { plan: planName(state.plan), count: paidDaysLeft(state, now) }),
                  value: `−${formatPlanPrice(quote.creditMinor, locale)}`,
                },
              ]
            : []),
          isRenew && trialing && state.periodEnd !== null
            ? { label: t("starts"), value: date(state.periodEnd) }
            : isRenew
              ? { label: t("added"), value: t("days", { count: PERIOD_DAYS }) }
              : { label: t("starts"), value: t("today") },
          ...(isRenew ? [] : [{ label: t("length"), value: t("days", { count: PERIOD_DAYS }) }]),
          { label: t("newEnd"), value: date(end), strong: true },
          { label: t("total"), value: amount, strong: true },
        ]}
      />

      <Reassurance />

      <DialogFooter className="sticky -bottom-5 -mx-5 -mb-5 border-t bg-popover px-5 pt-3 pb-5">
        <Button variant="ghost" onClick={onClose}>
          {t("notNow")}
        </Button>
        <Button onClick={pay} disabled={pending || !billing.payments.available}>
          {pending ? t("starting") : t("pay", { amount })}
        </Button>
      </DialogFooter>
    </>
  )
}

function DowngradeBody({
  state,
  target,
  catalog,
  now,
  onClose,
}: {
  state: SubscriptionState
  target: PlanId
  catalog: PlanCatalog
  now: number
  onClose: () => void
}) {
  const t = useTranslations("Billing.change")
  const planName = usePlanName()
  const locale = useLocale()
  const date = useLongDate()
  const impact = useQuery(api.billing.downgradeImpact, { plan: target })
  const scheduleDowngrade = useMutation(api.billing.scheduleDowngrade)
  const errorMessage = useErrorMessage()
  const [pending, setPending] = useState(false)

  const current = planName(state.plan)
  const name = planName(target)
  const end = state.periodEnd ?? now
  const freeOn = graceEndOf(state) ?? end
  const price = catalog.plans.find((p) => p.id === target)?.monthlyMinor ?? null

  // Recorded on the server (shown on the billing page, confirmation email); nothing changes now.
  async function switchPlan() {
    setPending(true)
    try {
      await scheduleDowngrade({ plan: target })
      toast.success(t("switchDone", { plan: current, date: date(end) }))
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
      setPending(false)
    }
  }

  return (
    <>
      <DialogTitle>{t("downgradeTitle", { plan: name })}</DialogTitle>
      <DialogDescription>{t("keepShop")}</DialogDescription>

      <Summary
        rows={[
          { label: t("total"), value: t("nothingNow", { amount: formatPlanPrice(0, locale) }), strong: true },
          { label: t("stays", { plan: current }), value: date(end), strong: true },
          { label: t("movesFree", { plan: planName("free") }), value: date(freeOn) },
        ]}
      />
      <p className="text-muted-foreground">
        {target === "free"
          ? t("downgradeFreeNote", { plan: current, date: date(end), free: planName("free"), days: GRACE_DAYS })
          : t("downgradePaidNote", {
              plan: current,
              target: name,
              free: planName("free"),
              days: PERIOD_DAYS,
              price: price === null ? "—" : formatPlanPrice(price, locale),
            })}
      </p>

      <section aria-labelledby="pauses-title" className="flex flex-col gap-2">
        <h3 id="pauses-title" className="text-sm font-semibold">
          {t("pausesTitle")}
        </h3>
        {impact === undefined ? <LoadingState className="py-4" /> : <PauseList impact={impact} />}
        <p className="text-muted-foreground">{t("comesBack")}</p>
      </section>

      <DialogFooter className="sticky -bottom-5 -mx-5 -mb-5 items-center border-t bg-popover px-5 pt-3 pb-5">
        <Button variant="link" className="text-muted-foreground underline" onClick={switchPlan} disabled={pending}>
          {t("switchTo", { plan: name })}
        </Button>
        <Button onClick={onClose}>{t("keep", { plan: current })}</Button>
      </DialogFooter>
    </>
  )
}

function PauseList({ impact }: { impact: DowngradeImpact }) {
  const t = useTranslations("Billing.change.pauses")
  if (!hasImpact(impact)) return <p>{t("nothing")}</p>
  const lines: string[] = []
  if (impact.sales > 0) lines.push(t("sales", { count: impact.sales }))
  if (impact.discountCodes > 0) lines.push(t("discountCodes", { count: impact.discountCodes }))
  if (impact.productsHidden > 0) lines.push(t("productsHidden", { count: impact.productsHidden }))
  if (impact.look) lines.push(t("look"))
  if (impact.sections) lines.push(t("sections"))
  if (impact.eventBanner) lines.push(t("eventBanner"))
  if (impact.promoBar) lines.push(t("promoBar"))
  return (
    <ul className="flex flex-col gap-1.5">
      {lines.map((line) => (
        <li key={line} className="flex items-start gap-2">
          <PauseCircleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  )
}

type Row = { label: string; value: string; strong?: boolean }

function Summary({ rows }: { rows: Row[] }) {
  return (
    <dl className="flex flex-col divide-y rounded-lg border">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-3 px-3 py-2">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className={cn("text-right tabular-nums", row.strong && "font-semibold text-foreground")}>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Reassurance(): ReactNode {
  const t = useTranslations("Billing.change")
  return (
    <p className="flex items-start gap-2 text-muted-foreground">
      <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      {t("reassurance")}
    </p>
  )
}
