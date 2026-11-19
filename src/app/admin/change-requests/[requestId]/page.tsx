import { redirect } from "next/navigation"
import { adminHref } from "@/features/admin/shell/hrefs"

/** Old link to one request: the list now opens it in a drawer. */
export default async function AdminChangeRequestPage({ params }: PageProps<"/admin/change-requests/[requestId]">) {
  const { requestId } = await params
  redirect(adminHref.changeRequest(requestId))
}
