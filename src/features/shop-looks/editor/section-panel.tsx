"use client"

import { LockIcon, RotateCcwIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import type { LookSection, SectionProps } from "./sections"
import { useUpgradePlanName } from "@/features/billing/use-plan-catalog"

/**
 * One section's content: its hint, the plan notice when the seller's plan
 * doesn't include it, its own "Reset to preset", then its options. The
 * title is drawn by the caller (desktop heading or sheet title).
 */
export function SectionPanel({ section, props }: { section: LookSection; props: SectionProps }) {
  const t = useTranslations("LookEditor")
  const { editor, mine, disabled } = props
  const { Panel, resets } = section
  const upgradePlan = useUpgradePlanName(section.lockedBy)
  const canReset = resets !== undefined && editor.draft.overrides[resets] !== undefined

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">{t(`sections.${section.key}Hint` as "sections.looksHint")}</p>
        {canReset ? (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => editor.setOverride(resets, undefined)}>
            <RotateCcwIcon />
            {t("actions.resetSection")}
          </Button>
        ) : null}
      </div>
      {section.locked(mine) ? (
        <div className="flex items-start gap-3 rounded-lg border bg-card p-3 text-sm">
          <LockIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="flex flex-col gap-2">
            <p>{t("lock.notice", { plan: upgradePlan })}</p>
            <Link href="/dashboard/billing" className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}>
              {t("lock.link")}
            </Link>
          </div>
        </div>
      ) : null}
      <Panel {...props} />
    </div>
  )
}
