"use client"

import { SearchIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import type { Id } from "../../../../convex/_generated/dataModel"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { useRoleLabel } from "../shell/use-admin-viewer"

export type UserStatusFilter = "" | "active" | "suspended"
export type UsersFilterValue = { search: string; roleId: Id<"roles"> | ""; status: UserStatusFilter }
type RoleOption = { _id: Id<"roles">; key: "super_admin" | "seller" | null; name: string }

/** Email search + role + status filters (the list debounces the search). */
export function UsersFilters({
  value,
  roles,
  onChange,
}: {
  value: UsersFilterValue
  roles: RoleOption[] | undefined
  onChange: (next: UsersFilterValue) => void
}) {
  const t = useTranslations("AdminUsers")
  const ts = useTranslations("UserStatus")
  const roleLabel = useRoleLabel()
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
      <label className="relative">
        <span className="sr-only">{t("search")}</span>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          placeholder={t("searchPlaceholder")}
          className="pl-9"
        />
      </label>
      <label>
        <span className="sr-only">{t("role")}</span>
        <NativeSelect
          value={value.roleId}
          onChange={(e) => onChange({ ...value, roleId: e.target.value as Id<"roles"> | "" })}
        >
          <option value="">{t("allRoles")}</option>
          {roles?.map((role) => (
            <option key={role._id} value={role._id}>
              {roleLabel(role)}
            </option>
          ))}
        </NativeSelect>
      </label>
      <label>
        <span className="sr-only">{t("status")}</span>
        <NativeSelect
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value as UserStatusFilter })}
        >
          <option value="">{t("allStatuses")}</option>
          <option value="active">{ts("active")}</option>
          <option value="suspended">{ts("suspended")}</option>
        </NativeSelect>
      </label>
    </div>
  )
}
