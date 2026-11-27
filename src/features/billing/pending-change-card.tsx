"use client"

import { useMutation } from "convex/react"
import { CalendarClockIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { cn } from "cn"
import { api } from "../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useErrorMessage } from "@/lib/use-error-message"
import type { MyBilling } from "./use-billing"
import { usePlanName } from "./use-plan-catalog"

/**
 * The lower plan the seller chose (`billing.scheduleDowngrade`), with
 * "Keep my plan" (`billing.keepPlan`). Opened from the confirmation email
 * with `?keep=<id>`: the card is highlighted and Keep is the main action;
 * the parameter is dropped once kept.
 */
export function PendingChangeCard({ billing, highlighted }: { billing: MyBilling; highlighted: boolean }) {
  const t = useTranslations("Billing.pendingChange")
  const planName = usePlanName()
  const format = useFormatter()
  const router = useRouter()
  const pathname = usePathname()
  const errorMessage = useErrorMessage()
  const keepPlan = useMutation(api.billing.keepPlan)
  const [pending, setPending] = useState(false)
  const change = billing.pendingChange
  if (change === null) return null

  const current = planName(billing.plan)
  const date = format.dateTime(new Date(change.effectiveAt), { dateStyle: "long" })

  async function keep() {
    if (change === null) return
    setPending(true)
    try {
      await keepPlan({ changeId: change._id })
      toast.success(t("kept", { plan: current }))
      if (highlighted) router.replace(pathname)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card
      role="status"
      aria-labelledby="pending-change-title"
      className={cn("flex-row flex-wrap items-center justify-between gap-3", highlighted && "border-foreground")}
    >
      <div className="flex min-w-0 items-start gap-3">
        <CalendarClockIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="flex flex-col gap-0.5">
          <p id="pending-change-title" className="font-semibold">
            {t("title", { plan: planName(change.toPlan), date })}
          </p>
          <p className="text-muted-foreground">{t("body", { current })}</p>
        </div>
      </div>
      <Button variant={highlighted ? "default" : "outline"} onClick={keep} disabled={pending}>
        {pending ? t("keeping") : t("keep")}
      </Button>
    </Card>
  )
}
