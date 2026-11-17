"use client"

import { LayoutGridIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { EmptyState, LoadingState } from "@/components/states/states"
import { Card, CardTitle } from "@/components/ui/card"
import { ADMIN_HOME, visibleNav } from "@/features/admin/shell/nav"
import { useAdminViewer, useRoleLabel } from "@/features/admin/shell/use-admin-viewer"

/**
 * Admin home: who you are and the sections your role opens. Becomes the
 * dashboard for `dashboard.view` holders in the next step.
 */
export default function AdminHomePage() {
  const t = useTranslations("Admin")
  const { viewer } = useAdminViewer()
  const roleLabel = useRoleLabel()
  if (!viewer) return <LoadingState />
  const sections = visibleNav(viewer.permissions).filter((item) => item.href !== ADMIN_HOME)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">{t("welcome")}</h1>
        <p className="text-sm break-words text-muted-foreground">
          {t("signedInAs", { email: viewer.email ?? "" })} · {roleLabel(viewer)}
        </p>
      </div>
      {sections.length === 0 ? (
        <EmptyState icon={<LayoutGridIcon />} title={t("noSectionsTitle")} body={t("noSectionsBody")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((item) => (
            <li key={item.key}>
              <Link href={item.href} className="block rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
                <Card className="hover:bg-muted">
                  <CardTitle>{t(`nav.${item.key}`)}</CardTitle>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
