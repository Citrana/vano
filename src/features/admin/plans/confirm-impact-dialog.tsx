"use client"

import { TriangleAlertIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import type { FeatureKey } from "../../../../convex/lib/planFeatures"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { LoadingState } from "@/components/states/states"
import { usePlanName } from "@/features/billing/use-plan-catalog"
import type { PendingChange } from "./use-plan-config"

/**
 * Before a change that removes a feature or lowers a limit (or a reset):
 * what is taken away, from which plans, and how many shops are on them
 * now. Nobody's data is touched; the feature just stops working.
 */
export function ConfirmImpactDialog({
  pending,
  onClose,
}: {
  pending: PendingChange | null
  onClose: () => void
}) {
  const t = useTranslations("AdminPlans.impact")
  const tf = useTranslations("PlanFeatures")
  const tc = useTranslations("Common")
  const planName = usePlanName()
  const locale = useLocale()
  const [saving, setSaving] = useState(false)
  const impact = pending?.impact ?? null
  const enforced = impact?.lowered.filter((l) => l.enforced) ?? []
  const list = (items: readonly string[]) => new Intl.ListFormat(locale, { type: "conjunction" }).format(items)
  const features = [...new Set(impact?.lowered.map((l) => tf(`${l.feature as FeatureKey}.name`)) ?? [])]
  const plans = [...new Set(enforced.map((l) => l.plan))].map(planName)

  return (
    <Dialog open={pending !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent>
        <DialogTitle>{pending?.kind === "reset" ? t("resetTitle") : t("title")}</DialogTitle>
        {impact === null ? (
          <LoadingState className="py-6" />
        ) : (
          <>
            <DialogDescription>
              {impact.lowered.length === 0
                ? t("nothingLost")
                : t("lost", { features: list(features.slice(0, 6)), more: Math.max(0, features.length - 6) })}
            </DialogDescription>
            <div className="flex flex-col gap-2 text-sm">
              {enforced.length > 0 ? (
                <p className="flex items-start gap-2 rounded-lg bg-secondary p-3 font-medium">
                  <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {impact.capped
                    ? t("shopsMany", { count: impact.shops, plans: list(plans) })
                    : t("shops", { count: impact.shops, plans: list(plans) })}
                </p>
              ) : impact.lowered.length > 0 ? (
                <p className="text-muted-foreground">{t("pricingOnly")}</p>
              ) : null}
              <p className="text-muted-foreground">{t("dataKept")}</p>
            </div>
          </>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>{tc("cancel")}</DialogClose>
          <Button
            variant="destructive"
            disabled={impact === null || saving}
            onClick={async () => {
              if (!pending) return
              setSaving(true)
              try {
                await pending.run()
              } finally {
                setSaving(false)
                onClose()
              }
            }}
          >
            {saving ? tc("saving") : pending?.kind === "reset" ? t("confirmReset") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
