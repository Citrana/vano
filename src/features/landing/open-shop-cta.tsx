"use client"

import { useConvexAuth, useQuery } from "convex/react"
import { ArrowRightIcon, LockIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { cn } from "cn"
import { api } from "../../../convex/_generated/api"
import { buttonVariants } from "@/components/ui/button"

/**
 * The main "Open my shop for free" button. Server-renders as a link to
 * /signup (works before Convex connects); signed-in visitors go to their
 * dashboard; when an admin has closed public sign-up, signed-out visitors
 * see a "closed" note instead. /signup is gated too (SignupClosedGate) and
 * the server refuses the account anyway.
 */
export function OpenShopCta({ compact = false, className }: { compact?: boolean; className?: string }) {
  const t = useTranslations("Landing")
  const { isLoading, isAuthenticated } = useConvexAuth()
  const signupOpen = useQuery(api.public.signupOpen, isLoading || isAuthenticated ? "skip" : {})

  const size = compact ? "default" : "lg"

  if (isAuthenticated) {
    return (
      <Link href="/dashboard" className={cn(buttonVariants({ size }), className)}>
        {compact ? t("ctaDashboardShort") : t("ctaDashboard")}
        {compact ? null : <ArrowRightIcon aria-hidden />}
      </Link>
    )
  }

  if (signupOpen === false) {
    // The nav already shows "Log in"; the note lives in the page CTAs.
    if (compact) return null
    return (
      <div role="status" className={cn("flex flex-col items-center gap-1 text-center", className)}>
        <p className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm font-medium">
          <LockIcon className="size-4 text-muted-foreground" aria-hidden />
          {t("signupClosed")}
        </p>
        <Link href="/login" className="min-h-11 content-center text-sm font-medium underline underline-offset-4">
          {t("signupClosedLogin")}
        </Link>
      </div>
    )
  }

  return (
    <Link href="/signup" className={cn(buttonVariants({ size }), className)}>
      {compact ? t("ctaShort") : t("cta")}
      {compact ? null : <ArrowRightIcon aria-hidden />}
    </Link>
  )
}
