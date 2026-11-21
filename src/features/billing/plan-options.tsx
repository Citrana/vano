"use client"

import { useMutation } from "convex/react"
import { CheckIcon, MessageCircleIcon } from "lucide-react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { cn } from "cn"
import { api } from "../../../convex/_generated/api"
import {
  EXPIRY_WARNING_DAYS,
  daysLeft,
  isPaidPlan,
  planRank,
  type PaidPlanId,
  type PlanId,
} from "../../../convex/lib/plans"
import { applyPurchase, type PlanPrices, type SubscriptionState } from "../../../convex/lib/subscriptions"
import type { PlanCatalog } from "../../../convex/lib/planCatalog"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { buildPlanCards, formatPlanPrice, type Plan } from "@/features/marketing/pricing/plans"
import { talkHref } from "@/features/marketing/shared/site-config"
import { useErrorMessage } from "@/lib/use-error-message"
import type { MyBilling } from "./use-billing"
import { usePlanCatalog, usePlanName } from "./use-plan-catalog"

type Action =
  | { kind: "current" }
  | { kind: "buy"; plan: PaidPlanId; label: string }
  | { kind: "free" }
  | { kind: "talk" }

/**
 * The plans (from the live plan catalogue; hidden plans are left out,
 * except the seller's current one) with what the seller can do on each: buy / renew a paid
 * plan (opens a confirmation with the new end date, then checkout), see
 * how moving to Free works, or talk to us (Enterprise, or when online
 * payments are off). One coral button: the most useful next step.
 */
export function PlanOptions({ billing, shopName, now }: { billing: MyBilling; shopName: string; now: number }) {
  const t = useTranslations("Billing")
  const tp = useTranslations("Pricing")
  const locale = useLocale()
  const catalog = usePlanCatalog()
  const planName = usePlanName()
  const [buying, setBuying] = useState<PaidPlanId | null>(null)
  const [freeOpen, setFreeOpen] = useState(false)

  const current = billing.effectivePlan
  const running = billing.status === "trialing" || billing.status === "active"
  if (!catalog) return null
  const shown = { ...catalog, plans: catalog.plans.map((p) => (p.id === current ? { ...p, visible: true } : p)) }
  const plans = buildPlanCards(shown, locale, (plan) => tp("everythingIn", { plan }))

  function actionFor(id: PlanId): Action {
    if (id === "enterprise") return current === "enterprise" ? { kind: "current" } : { kind: "talk" }
    if (id === "free") return current === "free" ? { kind: "current" } : { kind: "free" }
    if (!isPaidPlan(id)) return { kind: "talk" }
    if (!billing.payments.available) return id === current ? { kind: "current" } : { kind: "talk" }
    if (id === current && billing.status === "active") return { kind: "buy", plan: id, label: t("renew") }
    if (id === current) return { kind: "buy", plan: id, label: t("keep", { plan: planName(id) }) }
    return {
      kind: "buy",
      plan: id,
      label: planRank(id) > planRank(current) ? t("upgrade", { plan: planName(id) }) : t("switchTo", { plan: planName(id) }),
    }
  }

  // The one coral button: keep the trial plan, pick Pro when on Free, or
  // renew a plan that's about to end.
  const primary: PlanId | null = !billing.payments.available
    ? null
    : billing.status === "trialing"
      ? current
      : !running
        ? "pro"
        : billing.periodEnd !== null && daysLeft(billing.periodEnd, now) <= EXPIRY_WARNING_DAYS
          ? current
          : null

  return (
    <section aria-labelledby="plans-title" className="flex flex-col gap-3">
      <h2 id="plans-title" className="font-heading text-lg font-bold tracking-tight">
        {t("plansTitle")}
      </h2>
      {!billing.payments.available ? (
        <p role="status" className="rounded-lg bg-secondary p-3 text-sm">
          {t("paymentsOff")}
        </p>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => (
          <PlanOption
            key={plan.id}
            plan={plan}
            locale={locale}
            action={actionFor(plan.id)}
            isCurrent={plan.id === current}
            primary={plan.id === primary}
            talkLink={talkHref(t("talkMessage", { plan: planName(plan.id), shop: shopName }))}
            onBuy={setBuying}
            onFree={() => setFreeOpen(true)}
          />
        ))}
      </ul>

      <ConfirmPurchaseDialog billing={billing} catalog={catalog} plan={buying} now={now} onClose={() => setBuying(null)} />
      <FreeDialog billing={billing} open={freeOpen} onOpenChange={setFreeOpen} />
    </section>
  )
}

function PlanOption({
  plan,
  locale,
  action,
  isCurrent,
  primary,
  talkLink,
  onBuy,
  onFree,
}: {
  plan: Plan
  locale: string
  action: Action
  isCurrent: boolean
  primary: boolean
  talkLink: string
  onBuy: (plan: PaidPlanId) => void
  onFree: () => void
}) {
  const t = useTranslations("Billing")
  const planName = usePlanName()
  const headingId = `billing-plan-${plan.id}`

  return (
    <li
      aria-labelledby={headingId}
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4",
        isCurrent && "border-plum/60 ring-1 ring-plum/60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 id={headingId} className="text-lg font-extrabold">
          {plan.name}
        </h3>
        {isCurrent ? <Badge>{t("currentBadge")}</Badge> : null}
      </div>
      <p className="flex items-baseline gap-1">
        {plan.priceMinor === null ? (
          <span className="font-heading text-xl font-extrabold">{t("customPrice")}</span>
        ) : (
          <>
            <span className="font-heading text-2xl font-extrabold tabular-nums">{formatPlanPrice(plan.priceMinor, locale)}</span>
            {plan.priceMinor > 0 ? <span className="text-sm text-muted-foreground">{t("perMonth")}</span> : null}
          </>
        )}
      </p>
      <ul className="flex flex-1 flex-col gap-1.5">
        {plan.features.map((f) => (
          <li key={f.key} className="flex items-start gap-2">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={3} aria-hidden />
            <span>{f.label}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-1">
        {action.kind === "buy" ? (
          <Button variant={primary ? "default" : "outline"} className="w-full" onClick={() => onBuy(action.plan)}>
            {action.label}
          </Button>
        ) : action.kind === "talk" ? (
          <a
            href={talkLink}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", className: "w-full" })}
          >
            <MessageCircleIcon aria-hidden />
            {t("talk")}
          </a>
        ) : action.kind === "free" ? (
          <Button variant="ghost" className="w-full" onClick={onFree}>
            {t("switchTo", { plan: planName("free") })}
          </Button>
        ) : null}
      </div>
    </li>
  )
}

function stateOf(billing: MyBilling): SubscriptionState {
  return { plan: billing.plan, status: billing.status, periodStart: billing.periodStart, periodEnd: billing.periodEnd }
}

/** What paying changes (new end date), then starts checkout. */
function pricesFrom(catalog: PlanCatalog): PlanPrices {
  return Object.fromEntries(catalog.plans.map((p) => [p.id, p.monthlyMinor])) as PlanPrices
}

function ConfirmPurchaseDialog({
  billing,
  catalog,
  plan,
  now,
  onClose,
}: {
  billing: MyBilling
  catalog: PlanCatalog
  plan: PaidPlanId | null
  now: number
  onClose: () => void
}) {
  const t = useTranslations("Billing")
  const planName = usePlanName()
  const tc = useTranslations("Common")
  const locale = useLocale()
  const format = useFormatter()
  const router = useRouter()
  const errorMessage = useErrorMessage()
  const startCheckout = useMutation(api.billing.startCheckout)
  const [pending, setPending] = useState(false)

  const shown = plan ?? "pro"
  const state = stateOf(billing)
  const prices = pricesFrom(catalog)
  const next = applyPurchase(state, shown, now, prices)
  const price = prices[shown] ?? 0
  const running = billing.status === "trialing" || billing.status === "active"
  const note =
    billing.status === "trialing"
      ? t("confirmTrialKept")
      : running && billing.plan === shown
        ? t("confirmRenew")
        : running
          ? t("confirmCredit", { plan: planName(shown) })
          : null

  async function confirm() {
    if (!plan) return
    setPending(true)
    try {
      const paymentId = await startCheckout({ plan })
      router.push(`/dashboard/billing/checkout/${paymentId}`)
    } catch (error) {
      toast.error(errorMessage(error))
      setPending(false)
    }
  }

  return (
    <Dialog open={plan !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent>
        <DialogTitle>{t("confirmTitle", { plan: planName(shown) })}</DialogTitle>
        <DialogDescription>{t("confirmAmount", { amount: formatPlanPrice(price, locale) })}</DialogDescription>
        <div className="flex flex-col gap-2 text-sm">
          {next.periodEnd !== null ? (
            <p className="font-medium">{t("confirmNewEnd", { date: format.dateTime(new Date(next.periodEnd), { dateStyle: "long" }) })}</p>
          ) : null}
          {note ? <p className="text-muted-foreground">{note}</p> : null}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{tc("cancel")}</DialogClose>
          <Button onClick={confirm} disabled={pending}>
            {pending ? t("starting") : t("continue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Moving to Free needs no action: the plan simply runs out. */
function FreeDialog({
  billing,
  open,
  onOpenChange,
}: {
  billing: MyBilling
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("Billing")
  const planName = usePlanName()
  const format = useFormatter()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t("freeTitle")}</DialogTitle>
        <DialogDescription>
          {t("freeBody", {
            plan: planName(billing.effectivePlan),
            date: billing.periodEnd === null ? "—" : format.dateTime(new Date(billing.periodEnd), { dateStyle: "long" }),
          })}
        </DialogDescription>
        <DialogFooter>
          <DialogClose render={<Button />}>{t("freeOk")}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
