import { AdminGate } from "@/features/admin/shell/admin-gate"
import { AdminShell } from "@/features/admin/shell/admin-shell"

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AdminGate>
      <AdminShell>{children}</AdminShell>
    </AdminGate>
  )
}
