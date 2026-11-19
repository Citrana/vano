import { redirect } from "next/navigation"
import { adminHref } from "@/features/admin/shell/hrefs"

/** Old link to one user: the list now opens it in a drawer. */
export default async function AdminUserPage({ params }: PageProps<"/admin/users/[userId]">) {
  const { userId } = await params
  redirect(adminHref.user(userId))
}
