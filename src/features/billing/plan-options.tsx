"use client"

import { CheckIcon, MessageCircleIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { cn } from "cn"
import { EXPIRY_WARNING_DAYS, daysLeft, isPaidPlan, type PlanId } from "../../../convex/lib/plans"
import { planChangeKind } from "../../../convex/lib/subscriptions"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { buildPlanCards, formatPlanPrice, type Plan } from "@/features/marketing/pricing/plans"
import { talkHref } from "@/features/marketing/shared/site-config"
import { PlanChangeDialog, billingState } from "./plan-change-dialog"
import type { MyBilling } from "./use-billing"
import { usePlanCatalog, usePlanName } from "./use-plan-catalog"

type Action =
  | { kind: "current" }
  | { kind: "change"; plan: PlanId; label: string; tone: "buy" | "quiet" }
  | { kind: "talk" }

/**
 * The plans (from the live plan catalogue; hidden plans are left out,
 * except the seller's current one) with what the seller can do on each:
 * upgrade, extend or switch (all open the plan change dialog, which shows
 * the amount and the new end date from the shared rules), or talk to us
 * (Enterprise, or a purchase while online payments are off). One coral
 * button: the most useful next step. `initialPlan` opens the dialog for
 * that plan on load ("Get Business" → `?upgrade=business`).
 */
export function PlanOptions({
  billing,
  shopName,
  now,
  initialPlan,
}: {
  billing: MyBilling
  shopName: string
  now: number
  initialPlan?: PlanId | null
}) {
  const t = useTranslations("Billing")
  const tp = useTranslations("Pricing")
  const locale = useLocale()
  const catalog = usePlanCatalog()
  const planName = usePlanName()
  const state = billingState(billing)
  // "Get Business" opens the dialog only when it's really an upgrade to pay for.
  const [target, setTarget] = useState<PlanId | null>(() =>
    initialPlan && billing.payments.available && planChangeKind(state, initialPlan, now) === "upgrade" ? initialPlan : null,
  )

  const current = billing.effectivePlan
  const running = billing.status === "trialing" || billing.status === "active"
  if (!catalog) return null
  const shown = { ...catalog, plans: catalog.plans.map((p) => (p.id === current ? { ...p, visible: true } : p)) }
  const plans = buildPlanCards(shown, locale, (plan) => tp("everythingIn", { plan }))

  function actionFor(id: PlanId): Action {
    const kind = planChangeKind(state, id, now)
    if (kind === "current" || (id === current && (kind !== "renew" || !isPaidPlan(id)))) return { kind: "current" }
    // Moving down never charges anything, so it works without payments.
    if (kind === "downgrade") return { kind: "change", plan: id, label: t("switchTo", { plan: planName(id) }), tone: "quiet" }
    if (!isPaidPlan(id) || !billing.payments.available) return { kind: "talk" }
    if (kind === "renew") {
      const label = billing.status === "trialing" ? t("keep", { plan: planName(id) }) : t("extend", { plan: planName(id) })
      return { kind: "change", plan: id, label, tone: "buy" }
    }
    return { kind: "change", plan: id, label: t("upgrade", { plan: planName(id) }), tone: "buy" }
  }

  // The one coral button: keep the trial plan, pick Pro when on Free, or
  // extend a plan that's about to end (or in its grace days).
  const primary: PlanId | null = !billing.payments.available
    ? null
    : billing.status === "trialing"
      ? current
      : !running
        ? "pro"
        : billing.periodEnd !== null && daysLeft(billing.periodEnd, now) <= EXPIRY_WARNING_DAYS
          ? current
          : null

  function close() {
    setTarget(null)
    // Drop `?upgrade=` so a reload doesn't open the dialog again.
    if (initialPlan) window.history.replaceState(null, "", "/dashboard/billing")
  }

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
            onChange={setTarget}
          />
        ))}
      </ul>

      <PlanChangeDialog billing={billing} catalog={catalog} target={target} now={now} onClose={close} />
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
  onChange,
}: {
  plan: Plan
  locale: string
  action: Action
  isCurrent: boolean
  primary: boolean
  talkLink: string
  onChange: (plan: PlanId) => void
}) {
  const t = useTranslations("Billing")
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
        {action.kind === "change" ? (
          <Button
            variant={action.tone === "quiet" ? "ghost" : primary ? "default" : "outline"}
            className="w-full"
            onClick={() => onChange(action.plan)}
          >
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
        ) : null}
      </div>
    </li>
  )
}
