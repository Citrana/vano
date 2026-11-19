"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { cn } from "cn"
import {
  featureDef,
  featureValueProblem,
  inheritedFrom,
  resolvedValue,
  type FeatureKey,
  type FeatureValue,
  type PlanConfigData,
} from "../../../../convex/lib/planFeatures"
import type { PlanId } from "../../../../convex/lib/plans"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { usePlanName } from "@/features/billing/use-plan-catalog"

/**
 * One feature × plan cell: a switch for an on/off feature, a number (and
 * "Unlimited" where allowed) for a limit. A value a plan gets from a lower
 * plan ("Business includes everything in Pro") shows as "From Pro" and
 * can only be changed on that lower plan.
 */
export function FeatureValueControl({
  config,
  feature,
  plan,
  disabled,
  onChange,
  size = "compact",
}: {
  config: PlanConfigData
  feature: FeatureKey
  plan: PlanId
  disabled: boolean
  onChange: (value: FeatureValue) => void
  size?: "compact" | "large"
}) {
  const t = useTranslations("AdminPlans")
  const tf = useTranslations("PlanFeatures")
  const planName = usePlanName()
  const def = featureDef(feature)
  const own = config.features[feature].values[plan]
  const resolved = resolvedValue(config, feature, plan)
  const from = inheritedFrom(config, feature, plan)
  const label = t("cellLabel", { feature: tf(`${feature}.name`), plan: planName(plan) })
  const fromNote = from ? <span className="text-xs text-muted-foreground">{t("fromPlan", { plan: planName(from) })}</span> : null

  if (def.kind === "flag") {
    return (
      <span className="relative z-[1] inline-flex flex-col items-start">
        <Switch
          aria-label={label}
          checked={resolved === true}
          disabled={disabled || from !== null}
          onCheckedChange={(checked) => onChange(checked)}
        />
        {fromNote}
      </span>
    )
  }
  return (
    <span className="relative z-[1] inline-flex flex-col items-start gap-1">
      <LimitInput
        // A new value (another admin's save, a confirmed change) restarts the input.
        key={String(own)}
        label={label}
        value={own}
        allowUnlimited={def.unlimited}
        max={def.max}
        disabled={disabled}
        size={size}
        onCommit={(value) => {
          if (featureValueProblem(feature, value) === null) onChange(value)
        }}
      />
      {from ? (
        <span className="text-xs text-muted-foreground">
          {t("fromPlanValue", { plan: planName(from), value: resolved === null ? t("unlimited") : String(resolved) })}
        </span>
      ) : null}
    </span>
  )
}

function LimitInput({
  label,
  value,
  allowUnlimited,
  max,
  disabled,
  size,
  onCommit,
}: {
  label: string
  value: FeatureValue
  allowUnlimited: boolean
  max: number
  disabled: boolean
  size: "compact" | "large"
  onCommit: (value: FeatureValue) => void
}) {
  const t = useTranslations("AdminPlans")
  const unlimited = value === null
  const [text, setText] = useState(typeof value === "number" ? String(value) : "")

  const valid = /^\d+$/.test(text.trim()) && Number(text) <= max
  function commit() {
    if (!valid) {
      setText(typeof value === "number" ? String(value) : "")
      return
    }
    if (Number(text) !== value) onCommit(Number(text))
  }

  return (
    <span className={cn("flex items-center gap-2", size === "large" && "flex-wrap")}>
      {unlimited ? null : (
        <Input
          aria-label={label}
          inputMode="numeric"
          value={text}
          disabled={disabled}
          aria-invalid={!valid}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur()
            if (e.key === "Escape") setText(typeof value === "number" ? String(value) : "")
          }}
          className={cn("tabular-nums", size === "compact" ? "h-8 w-20 md:h-8" : "w-28")}
        />
      )}
      {allowUnlimited ? (
        <label className={cn("flex items-center gap-1.5 text-xs", size === "large" && "min-h-11 text-sm")}>
          <Checkbox
            aria-label={`${label}: ${t("unlimited")}`}
            checked={unlimited}
            disabled={disabled}
            onCheckedChange={(checked) => onCommit(checked ? null : Math.min(max, Number(text) || max))}
          />
          {t("unlimited")}
        </label>
      ) : null}
    </span>
  )
}
