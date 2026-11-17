"use client"

import { MessageCircleIcon, PackageIcon, StoreIcon, UsersIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { Card, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type Totals = { users: number; shops: number; products: number; whatsappClicks: number }

const TILES = [
  { key: "users", icon: UsersIcon },
  { key: "shops", icon: StoreIcon },
  { key: "products", icon: PackageIcon },
  { key: "whatsappClicks", icon: MessageCircleIcon },
] as const

/** All-time platform totals; skeletons while loading. */
export function PlatformTotals({ totals }: { totals: Totals | undefined }) {
  const t = useTranslations("AdminDashboard")
  const format = useFormatter()
  return (
    <Card>
      <CardTitle>{t("totals")}</CardTitle>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TILES.map(({ key, icon: Icon }) => (
          <div key={key} className="flex flex-col gap-1 rounded-lg bg-muted/60 p-3">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span className="leading-tight">{t(key)}</span>
            </dt>
            <dd className="font-heading text-2xl font-semibold tabular-nums">
              {totals ? format.number(totals[key]) : <Skeleton className="h-7 w-12" />}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
