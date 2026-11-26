"use client"

import { useQuery } from "convex/react"
import { LockIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { api } from "../../../convex/_generated/api"
import { EmptyState, LoadingState } from "@/components/states/states"
import { buttonVariants } from "@/components/ui/button"
import { pagePermission, SELLER_HOME } from "./seller-nav"

/**
 * Seller pages follow the viewer's role in the current shop (CLAUDE.md
 * "Team accounts"): a page their role can't open shows a short note and a
 * link home instead of failing queries. One rule (`pagePermission`) for
 * every page; the server checks every call anyway.
 */
export function SellerPageGuard({ children }: { children: ReactNode }) {
  const t = useTranslations("Team.noRole")
  const pathname = usePathname()
  const viewer = useQuery(api.users.viewer, {})
  if (viewer === undefined) return <LoadingState />
  const need = pagePermission(pathname)
  const list = need === null ? [] : typeof need === "string" ? [need] : need
  const allowed = list.length === 0 || list.some((p) => viewer?.permissions.includes(p))
  if (allowed) return <>{children}</>
  return (
    <EmptyState
      icon={<LockIcon />}
      title={t("title")}
      body={t("body")}
      action={
        <Link href={SELLER_HOME} className={buttonVariants({ variant: "outline" })}>
          {t("home")}
        </Link>
      }
    />
  )
}
