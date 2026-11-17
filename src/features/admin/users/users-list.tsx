"use client"

import { ChevronRightIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"
import type { Id } from "../../../../convex/_generated/dataModel"
import { useRoleLabel } from "../shell/use-admin-viewer"
import { UserStatusBadge } from "./user-status-badge"

export type UserRow = {
  _id: Id<"users">
  email: string
  roleKey: "super_admin" | "seller" | null
  roleName: string
  status: "active" | "suspended"
  createdAt: number
  shopName: string | null
}

/** Cards on phones, a table from `md`. Each row opens the user. */
export function UsersList({ rows }: { rows: UserRow[] }) {
  const t = useTranslations("AdminUsers")
  const format = useFormatter()
  const roleLabel = useRoleLabel()
  const date = (ms: number) => format.dateTime(new Date(ms), { dateStyle: "medium" })

  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <li key={row._id}>
            <Link
              href={`/admin/users/${row._id}`}
              className="flex min-h-11 items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 hover:bg-muted"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-medium">{row.email}</span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {roleLabel(row)}
                  <UserStatusBadge status={row.status} />
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {row.shopName ?? t("noShop")} · {date(row.createdAt)}
                </span>
              </div>
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">{t("email")}</th>
              <th scope="col" className="px-4 py-2 font-medium">{t("role")}</th>
              <th scope="col" className="px-4 py-2 font-medium">{t("status")}</th>
              <th scope="col" className="px-4 py-2 font-medium">{t("shop")}</th>
              <th scope="col" className="px-4 py-2 font-medium">{t("joined")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id} className="border-t hover:bg-muted/50">
                <td className="max-w-64 truncate px-4 py-3">
                  <Link href={`/admin/users/${row._id}`} className="font-medium hover:underline">
                    {row.email}
                  </Link>
                </td>
                <td className="px-4 py-3">{roleLabel(row)}</td>
                <td className="px-4 py-3"><UserStatusBadge status={row.status} /></td>
                <td className="max-w-48 truncate px-4 py-3 text-muted-foreground">{row.shopName ?? t("noShop")}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{date(row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
