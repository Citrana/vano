import { SettingsSection } from "@/features/admin/settings/settings-section"
import { RequirePermission } from "@/features/admin/shell/admin-gate"

export default function AdminSettingsPage() {
  return (
    <RequirePermission permission="settings.view">
      <SettingsSection />
    </RequirePermission>
  )
}
