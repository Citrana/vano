"use client"

import { useConvexAuth, useMutation, useQuery } from "convex/react"
import { LinkIcon, StoreIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { api } from "../../../convex/_generated/api"
import { invitePath } from "../../../convex/lib/team"
import { EmptyState, LoadingState } from "@/components/states/states"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { withNext } from "@/features/auth/next-param"
import { useNow } from "@/features/billing/use-billing"
import { useErrorMessage } from "@/lib/use-error-message"
import { RoleBadge } from "./role-label"

/**
 * The join page of a team invite: the shop, the role and what it allows;
 * signed out → sign in / create an account (they come back here); signed
 * in → "Join {shop}". The invite works once; joining switches the seller
 * screens to the shop.
 */
export function JoinInvite({ token }: { token: string }) {
  const t = useTranslations("Team.join")
  const tr = useTranslations("TeamRoles")
  const { isLoading, isAuthenticated } = useConvexAuth()
  const preview = useQuery(api.team.invitePreview, { token })
  const accept = useMutation(api.team.acceptInvite)
  const errorMessage = useErrorMessage()
  const router = useRouter()
  const now = useNow()
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const here = invitePath(token)

  if (preview === undefined || isLoading) return <LoadingState className="min-h-[40vh]" />

  const unusable =
    preview.state === "invalid"
      ? "invalid"
      : preview.state === "used"
        ? "used"
        : preview.state === "revoked"
          ? "invalid"
          : preview.expiresAt <= now
            ? "expired"
            : null
  if (preview.state === "invalid" || unusable) {
    return (
      <EmptyState
        className="w-full max-w-sm"
        icon={<LinkIcon />}
        title={t(`${unusable ?? "invalid"}Title`)}
        body={t(`${unusable ?? "invalid"}Body`)}
        action={
          <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
            {t("goDashboard")}
          </Link>
        }
      />
    )
  }

  async function join() {
    setError(null)
    setJoining(true)
    try {
      await accept({ token })
      router.replace("/dashboard")
    } catch (e) {
      setError(errorMessage(e))
      setJoining(false)
    }
  }

  return (
    <Card className="w-full max-w-sm gap-5">
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
          {preview.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
            <img src={preview.logoUrl} alt="" className="size-full object-cover" />
          ) : (
            <StoreIcon className="size-5 text-muted-foreground" aria-hidden />
          )}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-heading text-xl font-bold tracking-tight">{t("title", { shop: preview.shopName })}</h1>
          <RoleBadge role={preview.role} />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{tr(`${preview.role}.description`)}</p>

      {preview.relation === "owner" ? (
        <p role="status" className="text-sm">{t("ownShop")}</p>
      ) : preview.relation === "member" ? (
        <Link href="/dashboard" className={buttonVariants()}>
          {t("alreadyMember")}
        </Link>
      ) : isAuthenticated ? (
        <>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button size="lg" disabled={joining} onClick={join}>
            {t("join", { shop: preview.shopName })}
          </Button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm">{t("signInFirst")}</p>
          <Link href={withNext("/signup", here)} className={buttonVariants({ size: "lg" })}>
            {t("createAccount")}
          </Link>
          <Link href={withNext("/login", here)} className={buttonVariants({ variant: "outline", size: "lg" })}>
            {t("signIn")}
          </Link>
        </div>
      )}
    </Card>
  )
}
