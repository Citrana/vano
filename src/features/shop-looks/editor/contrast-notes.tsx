"use client"

import { AlertTriangleIcon, OctagonAlertIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { ratioLabel } from "../../../../convex/lib/looks/color"
import type { LookProblem } from "../../../../convex/lib/looks/contrast"
import { Button } from "@/components/ui/button"

const FIX_LABELS = {
  accent: "fixAccent",
  background: "fixBackground",
  profileBorder: "fixProfileBorder",
  announcementText: "fixAnnouncementText",
} as const satisfies Record<NonNullable<LookProblem["fix"]>["field"], string>

/**
 * The contrast check's findings (CLAUDE.md "Shop looks"): what may be hard
 * to read, the measured ratio, and a one-tap fix. "block" problems stop
 * publishing (the server refuses them too).
 */
export function ContrastNotes({
  problems,
  onFix,
  disabled = false,
}: {
  problems: readonly LookProblem[]
  onFix: (fix: NonNullable<LookProblem["fix"]>) => void
  disabled?: boolean
}) {
  const t = useTranslations("LookEditor.contrast")
  if (problems.length === 0) return null
  return (
    <ul className="flex flex-col gap-2" aria-live="polite">
      {problems.map((problem) => {
        const blocking = problem.level === "block"
        const Icon = blocking ? OctagonAlertIcon : AlertTriangleIcon
        return (
          <li
            key={problem.target}
            className={
              blocking
                ? "flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3"
                : "flex flex-col gap-2 rounded-lg border bg-tag-warning p-3 text-tag-warning-foreground"
            }
          >
            <p className="flex items-start gap-2 text-sm">
              <Icon className={blocking ? "mt-0.5 size-4 shrink-0 text-destructive" : "mt-0.5 size-4 shrink-0"} aria-hidden />
              <span>
                <span className="font-semibold">{t(`targets.${problem.target}`)}</span>{" "}
                {t(blocking ? "blocking" : "warning", { ratio: ratioLabel(problem.ratio) })}
              </span>
            </p>
            {problem.fix ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={disabled}
                onClick={() => problem.fix && onFix(problem.fix)}
              >
                <span
                  className="size-4 rounded-full ring-1 ring-foreground/20"
                  style={{ backgroundColor: problem.fix.value }}
                  aria-hidden
                />
                {t(
                  FIX_LABELS[problem.fix.field],
                  { color: problem.fix.value },
                )}
              </Button>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
