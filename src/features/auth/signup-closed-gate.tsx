"use client"

import { useQuery } from "convex/react"
import { LockIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import type { ReactNode } from "react"
import { api } from "../../../convex/_generated/api"
import { EmptyState, LoadingState } from "@/components/states/states"
import { buttonVariants } from "@/components/ui/button"

/**
 * Shows the sign-up form only while public sign-up is open (admin
 * settings). The server refuses sign-ups anyway when it's closed.
 */
export function SignupClosedGate({ children }: { children: ReactNode }) {
  const t = useTranslations("Auth")
  const open = useQuery(api.public.signupOpen, {})
  if (open === undefined) return <LoadingState />
  if (open) return <>{children}</>
  return (
    <EmptyState
      className="w-full max-w-sm"
      icon={<LockIcon />}
      title={t("signupClosedTitle")}
      body={t("signupClosedBody")}
      action={
        <Link href="/login" className={buttonVariants({ variant: "outline" })}>
          {t("goToLogin")}
        </Link>
      }
    />
  )
}
