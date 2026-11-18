"use client"

import { ChevronRightIcon } from "lucide-react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import type { Id } from "../../../../convex/_generated/dataModel"
import { countryName } from "@/features/shop/countries"
import { ShopStatusBadge } from "./shop-status-badge"

export type ShopRow = {
  _id: Id<"shops">
  name: string
  slug: string
  status: "active" | "suspended"
  currency: string
  city: string
  country: string
  ownerEmail: string
  createdAt: number
}

/** Cards on phones, a table from `md`. Each row opens the shop. */
export function ShopsList({ rows }: { rows: ShopRow[] }) {
  const t = useTranslations("AdminShops")
  const format = useFormatter()
  const locale = useLocale()
  const date = (ms: number) => format.dateTime(new Date(ms), { dateStyle: "medium" })
  const place = (row: ShopRow) => `${row.city}, ${countryName(row.country, locale)}`

  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <li key={row._id}>
            <Link
              href={`/admin/shops/${row._id}`}
              className="flex min-h-11 items-center gap-3 rounded-xl bg-card p-3 border hover:bg-muted"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{row.name}</span>
                  <ShopStatusBadge status={row.status} />
                </span>
                <span className="truncate text-xs text-muted-foreground">/{row.slug} · {row.ownerEmail}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {place(row)} · {row.currency} · {date(row.createdAt)}
                </span>
              </div>
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-xl bg-card border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">{t("shop")}</th>
              <th scope="col" className="px-4 py-2 font-medium">{t("owner")}</th>
              <th scope="col" className="px-4 py-2 font-medium">{t("status")}</th>
              <th scope="col" className="px-4 py-2 font-medium">{t("place")}</th>
              <th scope="col" className="px-4 py-2 font-medium">{t("currency")}</th>
              <th scope="col" className="px-4 py-2 font-medium">{t("created")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id} className="border-t hover:bg-muted/50">
                <td className="max-w-56 px-4 py-3">
                  <Link href={`/admin/shops/${row._id}`} className="block truncate font-medium hover:underline">
                    {row.name}
                  </Link>
                  <span className="block truncate text-xs text-muted-foreground">/{row.slug}</span>
                </td>
                <td className="max-w-48 truncate px-4 py-3 text-muted-foreground">{row.ownerEmail}</td>
                <td className="px-4 py-3"><ShopStatusBadge status={row.status} /></td>
                <td className="max-w-40 truncate px-4 py-3 text-muted-foreground">{place(row)}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.currency}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{date(row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
