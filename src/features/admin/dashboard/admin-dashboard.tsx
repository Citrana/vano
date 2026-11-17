"use client"

import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { api } from "../../../../convex/_generated/api"
import { utcDay } from "../../../../convex/lib/days"
import { useAdminViewer, useRoleLabel } from "../shell/use-admin-viewer"
import { PlatformGrowth } from "./platform-growth"
import { PlatformTotals } from "./platform-totals"

/** The admin dashboard (`dashboard.view`): live platform numbers. */
export function AdminDashboard() {
  const t = useTranslations("AdminDashboard")
  const ta = useTranslations("Admin")
  const { viewer } = useAdminViewer()
  const roleLabel = useRoleLabel()
  // Queries can't read the clock, so the client passes "today" (UTC).
  const [today] = useState(() => utcDay(Date.now()))
  const stats = useQuery(api.admin.dashboard.overview, { today })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">{t("title")}</h1>
        {viewer ? (
          <p className="text-sm break-words text-muted-foreground">
            {ta("signedInAs", { email: viewer.email ?? "" })} · {roleLabel(viewer)}
          </p>
        ) : null}
      </div>
      <PlatformTotals totals={stats?.totals} />
      <PlatformGrowth last7={stats?.last7} last30={stats?.last30} />
      <p className="text-xs text-muted-foreground">{t("utcNote")}</p>
    </div>
  )
}
