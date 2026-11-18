"use client"

import { useQuery } from "convex/react"
import { ChevronRightIcon, PlusIcon, ShieldCheckIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { api } from "../../../../convex/_generated/api"
import { ALL_PERMISSIONS } from "../../../../convex/lib/permissions"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, LoadingState } from "@/components/states/states"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { useAdminViewer, useRoleLabel } from "../shell/use-admin-viewer"

/** /admin/roles: built-in roles first, then custom roles. */
export function RolesSection() {
  const t = useTranslations("AdminRoles")
  const roleLabel = useRoleLabel()
  const { viewer } = useAdminViewer()
  const roles = useQuery(api.admin.roles.list, {})
  const canManage = viewer?.permissions.includes("roles.manage") ?? false

  if (roles === undefined) return <><PageTitle title={t("title")} /><LoadingState /></>
  const hasCustom = roles.some((r) => r.key === null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <PageTitle title={t("title")} />
        {canManage ? (
          <Link href="/admin/roles/new" className={buttonVariants()}>
            <PlusIcon />
            {t("newRole")}
          </Link>
        ) : null}
      </div>
      <ul className="flex flex-col gap-2">
        {roles.map((role) => (
          <li key={role._id}>
            <Link
              href={`/admin/roles/${role._id}`}
              className="flex min-h-11 items-center gap-3 rounded-xl bg-card p-4 border hover:bg-muted"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {roleLabel(role)}
                  {role.key ? <Badge variant="muted">{t("builtIn")}</Badge> : null}
                </span>
                {role.description ? <span className="text-sm text-muted-foreground">{role.description}</span> : null}
                <span className="text-xs text-muted-foreground">
                  {role.permissions.length === ALL_PERMISSIONS.length
                    ? t("allPermissions")
                    : t("permissionCount", { count: role.permissions.length })}
                  {" · "}
                  {role.userCountCapped ? t("userCountMany") : t("userCount", { count: role.userCount })}
                </span>
              </div>
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {hasCustom ? null : (
        <EmptyState icon={<ShieldCheckIcon />} title={t("emptyTitle")} body={t("emptyBody")} />
      )}
    </div>
  )
}
