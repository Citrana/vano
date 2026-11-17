"use client"

import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { api } from "../../../../convex/_generated/api"
import { PageTitle } from "@/components/shell/page-title"
import { RoleForm } from "./role-form"

export function NewRole() {
  const t = useTranslations("AdminRoles")
  const create = useMutation(api.admin.roles.create)
  const router = useRouter()
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title={t("newRole")} backHref="/admin/roles" backLabel={t("back")} />
      <RoleForm
        initial={{ name: "", description: "", permissions: [] }}
        submitLabel={t("create")}
        onSubmit={async (values) => {
          const roleId = await create(values)
          toast.success(t("created"))
          router.replace(`/admin/roles/${roleId}`)
        }}
      />
    </div>
  )
}
