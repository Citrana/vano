import { redirect } from "next/navigation"
import { adminHref } from "@/features/admin/shell/hrefs"

/** Old link to one role: the list now opens it in a drawer. */
export default async function AdminRolePage({ params }: PageProps<"/admin/roles/[roleId]">) {
  const { roleId } = await params
  redirect(adminHref.role(roleId))
}
