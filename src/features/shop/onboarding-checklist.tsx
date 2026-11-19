"use client"

import { useMutation } from "convex/react"
import { CheckIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import { cn } from "cn"
import { api } from "../../../convex/_generated/api"
import { allStepsDone, onboardingSteps, type OnboardingStepKey } from "../../../convex/lib/onboarding"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { useErrorMessage } from "@/lib/use-error-message"
import { SHARE_CARD_ID } from "./share-shop-card"

type ChecklistShop = {
  hasLook: boolean
  onboarding?: { linkSharedAt?: number; checklistHiddenAt?: number }
}

type ActionStep = Exclude<OnboardingStepKey, "created">

const STEP_HREF: Partial<Record<ActionStep, string>> = {
  product: "/dashboard/products/new",
  look: "/dashboard/look",
}

/** Scrolls to the share card and moves focus there (it's above on phones). */
function focusShareCard() {
  const card = document.getElementById(SHARE_CARD_ID)
  if (!card) return
  card.scrollIntoView({ behavior: "smooth", block: "center" })
  card.focus({ preventScroll: true })
}

/**
 * "Get your shop ready": the first steps for a new shop, ticked from real
 * data. Once all are done the seller can hide it for good.
 */
export function OnboardingChecklist({
  shop,
  productCount,
  canEdit,
}: {
  shop: ChecklistShop
  productCount: number
  canEdit: boolean
}) {
  const t = useTranslations("Dashboard.checklist")
  const errorMessage = useErrorMessage()
  const hide = useMutation(api.shops.hideChecklist)
  const [hiding, setHiding] = useState(false)

  if (shop.onboarding?.checklistHiddenAt !== undefined) return null
  const steps = onboardingSteps({
    productCount,
    hasLook: shop.hasLook,
    linkSharedAt: shop.onboarding?.linkSharedAt,
  })
  const done = steps.filter((step) => step.done).length
  const finished = allStepsDone(steps)

  async function onHide() {
    setHiding(true)
    try {
      await hide({})
    } catch (error) {
      toast.error(errorMessage(error))
      setHiding(false)
    }
  }

  function action(key: OnboardingStepKey): ReactNode {
    // "Shop created" is always done, so it never needs a button.
    if (key === "created") return null
    const label = t(`steps.${key}.action`)
    const className = buttonVariants({ variant: "outline", size: "sm" })
    if (key === "share") {
      return (
        <Button variant="outline" size="sm" onClick={focusShareCard}>
          {label}
        </Button>
      )
    }
    const href = STEP_HREF[key]
    if (!href || !canEdit) return null
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    )
  }

  return (
    <Card aria-labelledby="checklist-title">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle id="checklist-title">{finished ? t("doneTitle") : t("title")}</CardTitle>
          <span className="text-sm font-medium text-muted-foreground tabular-nums">
            {t("progress", { done, total: steps.length })}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={t("title")}
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={done}
          aria-valuetext={t("progress", { done, total: steps.length })}
          className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-plum transition-[width]" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
      </CardHeader>

      <ol className="flex flex-col divide-y">
        {steps.map(({ key, done: stepDone }) => (
          <li key={key} className="flex flex-wrap items-start gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border",
                stepDone ? "border-transparent bg-plum text-white" : "border-border-strong",
              )}
            >
              {stepDone ? <CheckIcon className="size-3.5" /> : null}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className={cn("font-semibold", stepDone && "text-muted-foreground line-through decoration-1")}>
                {t(`steps.${key}.title`)}
                <span className="sr-only"> {stepDone ? t("stepDone") : t("stepTodo")}</span>
              </p>
              {stepDone ? null : <p className="text-muted-foreground">{t(`steps.${key}.body`)}</p>}
            </div>
            {stepDone ? null : <div className="w-full pl-9 empty:hidden sm:w-auto sm:shrink-0 sm:self-center sm:pl-0">{action(key)}</div>}
          </li>
        ))}
      </ol>

      {finished && canEdit ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <p className="text-muted-foreground">{t("doneBody")}</p>
          <Button variant="ghost" size="sm" onClick={onHide} disabled={hiding}>
            {t("hide")}
          </Button>
        </div>
      ) : null}
    </Card>
  )
}
