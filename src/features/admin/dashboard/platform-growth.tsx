"use client"

import { useFormatter, useTranslations } from "next-intl"
import { Card, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type Window = { signups: number; shops: number }

/** New sign-ups and shops over the last 7 and 30 days, as a small table. */
export function PlatformGrowth({ last7, last30 }: { last7: Window | undefined; last30: Window | undefined }) {
  const t = useTranslations("AdminDashboard")
  const format = useFormatter()
  const cell = (value: number | undefined) =>
    value === undefined ? <Skeleton className="ml-auto h-5 w-8" /> : format.number(value)
  const rows = [
    { key: "signups", label: t("signups") },
    { key: "shops", label: t("newShops") },
  ] as const

  return (
    <Card>
      <CardTitle>{t("growth")}</CardTitle>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th scope="col" className="pb-2 text-left font-normal">
              <span className="sr-only">{t("growth")}</span>
            </th>
            <th scope="col" className="pb-2 text-right font-normal">{t("last7")}</th>
            <th scope="col" className="pb-2 text-right font-normal">{t("last30")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label }) => (
            <tr key={key} className="border-t">
              <th scope="row" className="py-3 text-left font-medium">{label}</th>
              <td className="py-3 text-right font-heading text-lg font-bold tracking-tight tabular-nums">{cell(last7?.[key])}</td>
              <td className="py-3 text-right font-heading text-lg font-bold tracking-tight tabular-nums">{cell(last30?.[key])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
