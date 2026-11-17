"use client"

import type { ReactNode } from "react"
import { AlertTriangleIcon, Loader2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"
import { Button } from "@/components/ui/button"

/** Full-area spinner for client pages waiting on Convex. */
export function LoadingState({ className }: { className?: string }) {
  const t = useTranslations("Common")
  return (
    <div role="status" className={cn("flex flex-1 items-center justify-center py-16", className)}>
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" aria-hidden />
      <span className="sr-only">{t("loading")}</span>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  body?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center",
        className
      )}
    >
      {icon ? <div className="text-muted-foreground [&_svg]:size-8">{icon}</div> : null}
      <h2 className="font-heading text-lg font-bold tracking-tight">{title}</h2>
      {body ? <p className="max-w-sm text-sm text-muted-foreground">{body}</p> : null}
      {action}
    </div>
  )
}

export function ErrorState({ onRetry, className }: { onRetry?: () => void; className?: string }) {
  const t = useTranslations("States")
  const tc = useTranslations("Common")
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      <AlertTriangleIcon className="size-8 text-destructive" aria-hidden />
      <h2 className="font-heading text-lg font-bold tracking-tight">{t("errorTitle")}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{t("errorBody")}</p>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          {tc("retry")}
        </Button>
      ) : null}
    </div>
  )
}
