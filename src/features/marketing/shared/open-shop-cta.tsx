"use client"

import { useConvexAuth, useQuery } from "convex/react"
import { ArrowRightIcon, LockIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { cn } from "cn"
import { api } from "../../../../convex/_generated/api"
import { buttonVariants } from "@/components/ui/button"
import { BUSINESS_CHECKOUT_HREF } from "@/features/billing/start-plan"

/**
 * The main "Open my shop for free" button. Server-renders as a link to
 * /signup (works before Convex connects); signed-in visitors go to their
 * dashboard; when an admin has closed public sign-up, signed-out visitors
 * see a "closed" note instead. /signup is gated too (SignupClosedGate) and
 * the server refuses the account anyway.
 */
export function OpenShopCta({
  compact = false,
  hideWhenClosed = false,
  variant = "default",
  label,
  plan,
  className,
}: {
  compact?: boolean
  /** "outline" for secondary placements (e.g. non-highlighted plan cards). */
  variant?: "default" | "outline"
  /** The nav already shows "Log in", so it hides the button instead of showing the note. */
  hideWhenClosed?: boolean
  /** Replaces the sign-up label (e.g. "Start free trial" on plan cards). */
  label?: string
  /**
   * "business" (the pricing page's "Get Business"): sign-up skips the Pro
   * trial and opens the Business payment; signed-in sellers go straight to
   * it. The label stays the same when signed in.
   */
  plan?: "business"
  className?: string
}) {
  const t = useTranslations("Marketing")
  const { isLoading, isAuthenticated } = useConvexAuth()
  const signupOpen = useQuery(api.public.signupOpen, isLoading || isAuthenticated ? "skip" : {})

  const size = compact ? "default" : "lg"

  if (isAuthenticated && plan) {
    return (
      <Link href={BUSINESS_CHECKOUT_HREF} className={cn(buttonVariants({ size, variant }), className)}>
        {label ?? t("ctaDashboard")}
      </Link>
    )
  }

  if (isAuthenticated) {
    return (
      <Link href="/dashboard" className={cn(buttonVariants({ size, variant }), className)}>
        {compact ? t("ctaDashboardShort") : t("ctaDashboard")}
        {compact ? null : <ArrowRightIcon aria-hidden />}
      </Link>
    )
  }

  if (signupOpen === false) {
    if (hideWhenClosed) return null
    if (compact) {
      return (
        <p role="status" className={cn("inline-flex items-center gap-1.5 text-sm font-medium", className)}>
          <LockIcon className="size-4 text-muted-foreground" aria-hidden />
          {t("signupClosed")}
        </p>
      )
    }
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
    <Link href={plan ? `/signup?plan=${plan}` : "/signup"} className={cn(buttonVariants({ size, variant }), className)}>
      {label ?? (compact ? t("ctaShort") : t("cta"))}
      {compact ? null : <ArrowRightIcon aria-hidden />}
    </Link>
  )
}
