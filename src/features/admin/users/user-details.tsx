"use client"

import { useQuery } from "convex/react"
import { ExternalLinkIcon, UserXIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"
import { api } from "../../../../convex/_generated/api"
import { EmptyState, LoadingState } from "@/components/states/states"
import { Card, CardTitle } from "@/components/ui/card"
import { DetailItem, DetailList } from "@/components/data-table/detail-list"
import { StatusTag } from "@/components/data-table/status-tag"
import { adminHref } from "../shell/hrefs"
import { useAdminViewer, useRoleLabel } from "../shell/use-admin-viewer"
import { ChangeRoleForm } from "./change-role-form"
import { SuspendUserDialog } from "./suspend-user-dialog"

/** The user drawer: details plus the actions the viewer may take. */
export function UserDetails({ userId }: { userId: string }) {
  const t = useTranslations("AdminUsers")
  const format = useFormatter()
  const roleLabel = useRoleLabel()
  const { viewer } = useAdminViewer()
  const user = useQuery(api.admin.users.get, { userId })

  if (user === undefined || !viewer) return <LoadingState />
  if (user === null) return <EmptyState icon={<UserXIcon />} title={t("notFoundTitle")} body={t("notFoundBody")} />

  const viewerIsSuperAdmin = viewer.roleKey === "super_admin"
  // Hide what can't work; the server enforces the same rules.
  const touchable = !user.isSelf && (viewerIsSuperAdmin || !user.isSuperAdmin)
  const canSuspend = touchable && viewer.permissions.includes("users.suspend")
  const canAssign = touchable && viewer.permissions.includes("users.assignRole")

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-col gap-1">
          <CardTitle className="break-all">{user.email}</CardTitle>
          {user.isSelf ? <p className="text-xs text-muted-foreground">{t("thisIsYou")}</p> : null}
        </div>
        <DetailList>
          <DetailItem label={t("role")}>{user.role ? roleLabel(user.role) : t("noRole")}</DetailItem>
          <DetailItem label={t("status")}>
            <StatusTag kind="user" status={user.status} />
          </DetailItem>
          <DetailItem label={t("joined")}>{format.dateTime(new Date(user.createdAt), { dateStyle: "long" })}</DetailItem>
          <DetailItem label={t("shop")}>
            <span className="flex flex-wrap items-center gap-2">
              {user.shop ? (
                <>
                  {viewer.permissions.includes("shops.view") ? (
                    <Link href={adminHref.shop(user.shop._id)} className="font-medium hover:underline">
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
                  {user.shop.status === "suspended" ? <StatusTag kind="shop" status="suspended" /> : null}
                </>
              ) : (
                t("noShop")
              )}
            </span>
          </DetailItem>
        </DetailList>
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
