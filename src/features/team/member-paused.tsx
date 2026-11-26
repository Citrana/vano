"use client"

import { useQuery } from "convex/react"
import { PauseCircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { api } from "../../../convex/_generated/api"
import { buttonVariants } from "@/components/ui/button"
import { SignOutButton } from "@/features/auth/sign-out-button"

/**
 * A team member with no shop they can use right now (CLAUDE.md "Team
 * accounts"): the shop's plan no longer includes their seat (paused, back
 * when the owner upgrades) or the owner suspended them. Short and calm;
 * they can still open their own shop.
 */
export function MemberPaused() {
  const t = useTranslations("Team.paused")
  const viewer = useQuery(api.users.viewer, {})
  const shops = viewer?.shops.filter((s) => s.role !== "owner") ?? []
  const suspendedOnly = shops.length > 0 && shops.every((s) => s.state === "suspended")
  const names = shops.map((s) => s.name).join(", ")

  return (
    <div role="status" className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <PauseCircleIcon className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="font-heading text-2xl font-bold tracking-tight">
        {suspendedOnly ? t("suspendedTitle") : t("title")}
      </h1>
      <p className="text-muted-foreground">
        {suspendedOnly ? t("suspendedBody", { shop: names }) : t("body", { shop: names })}
      </p>
      <div className="mt-2 flex w-full flex-col gap-2">
        <Link href="/onboarding" className={buttonVariants({ variant: "outline" })}>
          {t("createOwn")}
        </Link>
        <SignOutButton variant="ghost" showLabel />
      </div>
    </div>
  )
}
