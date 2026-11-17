"use client"

import { useMutation, useQuery } from "convex/react"
import { InfoIcon, ShieldXIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { api } from "../../../../convex/_generated/api"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, LoadingState } from "@/components/states/states"
import { Card } from "@/components/ui/card"
import { useAdminViewer, useRoleLabel } from "../shell/use-admin-viewer"
import { DeleteRoleDialog } from "./delete-role-dialog"
import { PermissionGrid } from "./permission-grid"
import { RoleForm } from "./role-form"

/** /admin/roles/[roleId]: edit a custom role, or a read-only view with the reason. */
export function RoleDetails({ roleId }: { roleId: string }) {
  const t = useTranslations("AdminRoles")
  const roleLabel = useRoleLabel()
  const { viewer } = useAdminViewer()
  const role = useQuery(api.admin.roles.get, { roleId })
  const update = useMutation(api.admin.roles.update)

  const title = role ? roleLabel(role) : t("roleTitle")
  const header = <PageTitle title={title} backHref="/admin/roles" backLabel={t("back")} />
  if (role === undefined || !viewer) return <>{header}<LoadingState /></>
  if (role === null) {
    return <>{header}<EmptyState icon={<ShieldXIcon />} title={t("notFoundTitle")} body={t("notFoundBody")} /></>
  }

  const canManage = viewer.permissions.includes("roles.manage")
  const ownLocked = role.isOwnRole && viewer.roleKey !== "super_admin"
  const reason = role.isBuiltIn
    ? role.key === "super_admin"
      ? t("readOnlySuperAdmin")
      : t("readOnlySeller")
    : ownLocked
      ? t("readOnlyOwn")
      : !canManage
        ? t("readOnlyNoPermission")
        : null

  if (reason) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {header}
        <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
          <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {reason}
        </p>
        {role.description ? <p className="text-sm text-muted-foreground">{role.description}</p> : null}
        <Card>
          <PermissionGrid value={role.permissions} canGrant={() => false} readOnly />
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      {header}
      <Card>
        <RoleForm
          key={role._id}
          initial={{ name: role.name, description: role.description ?? "", permissions: role.permissions }}
          submitLabel={t("save")}
          onSubmit={async (values) => {
            await update({ roleId: role._id, ...values })
            toast.success(t("saved"))
          }}
        />
      </Card>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {role.userCountCapped ? t("userCountMany") : t("userCount", { count: role.userCount })}
        </p>
        <DeleteRoleDialog roleId={role._id} name={role.name} inUse={role.userCount > 0} />
      </div>
    </div>
  )
}
