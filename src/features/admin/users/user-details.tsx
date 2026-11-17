"use client"

import { useQuery } from "convex/react"
import { ExternalLinkIcon, UserXIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"
import { api } from "../../../../convex/_generated/api"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, LoadingState } from "@/components/states/states"
import { Badge } from "@/components/ui/badge"
import { Card, CardTitle } from "@/components/ui/card"
import { useAdminViewer, useRoleLabel } from "../shell/use-admin-viewer"
import { ChangeRoleForm } from "./change-role-form"
import { SuspendUserDialog } from "./suspend-user-dialog"
import { UserStatusBadge } from "./user-status-badge"

/** /admin/users/[userId]: details plus the actions the viewer may take. */
export function UserDetails({ userId }: { userId: string }) {
  const t = useTranslations("AdminUsers")
  const ts = useTranslations("UserStatus")
  const format = useFormatter()
  const roleLabel = useRoleLabel()
  const { viewer } = useAdminViewer()
  const user = useQuery(api.admin.users.get, { userId })

  const back = <PageTitle title={t("detailsTitle")} backHref="/admin/users" backLabel={t("back")} />
  if (user === undefined || !viewer) return <>{back}<LoadingState /></>
  if (user === null) {
    return (
      <>
        {back}
        <EmptyState icon={<UserXIcon />} title={t("notFoundTitle")} body={t("notFoundBody")} />
      </>
    )
  }

  const viewerIsSuperAdmin = viewer.roleKey === "super_admin"
  // Hide what can't work; the server enforces the same rules.
  const touchable = !user.isSelf && (viewerIsSuperAdmin || !user.isSuperAdmin)
  const canSuspend = touchable && viewer.permissions.includes("users.suspend")
  const canAssign = touchable && viewer.permissions.includes("users.assignRole")

  return (
    <div className="flex flex-col gap-4">
      {back}
      <Card>
        <div className="flex flex-col gap-1">
          <CardTitle className="break-all">{user.email}</CardTitle>
          {user.isSelf ? <p className="text-xs text-muted-foreground">{t("thisIsYou")}</p> : null}
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">{t("role")}</dt>
            <dd>{user.role ? roleLabel(user.role) : t("noRole")}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">{t("status")}</dt>
            <dd><UserStatusBadge status={user.status} /></dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">{t("joined")}</dt>
            <dd>{format.dateTime(new Date(user.createdAt), { dateStyle: "long" })}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">{t("shop")}</dt>
            <dd className="flex flex-wrap items-center gap-2">
              {user.shop ? (
                <>
                  {viewer.permissions.includes("shops.view") ? (
                    <Link href={`/admin/shops/${user.shop._id}`} className="font-medium hover:underline">
                      {t("manageShop")}
                    </Link>
                  ) : null}
                  <a
                    href={`/${user.shop.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium hover:underline"
                  >
                    {user.shop.name}
                    <ExternalLinkIcon className="size-3.5" aria-hidden />
                  </a>
                  {user.shop.status === "suspended" ? <Badge variant="destructive">{ts("suspended")}</Badge> : null}
                </>
              ) : (
                t("noShop")
              )}
            </dd>
          </div>
        </dl>
      </Card>

      {canSuspend || canAssign ? (
        <Card>
          <CardTitle>{t("actions")}</CardTitle>
          {canAssign ? (
            <ChangeRoleForm
              userId={user._id}
              email={user.email}
              currentRoleId={user.role?._id ?? null}
              viewerIsSuperAdmin={viewerIsSuperAdmin}
            />
          ) : null}
          {canSuspend ? (
            <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {user.status === "active" ? t("suspendHint") : t("reactivateHint")}
              </p>
              <SuspendUserDialog userId={user._id} email={user.email} status={user.status} />
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  )
}
