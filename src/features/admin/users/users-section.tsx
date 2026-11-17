"use client"

import { usePaginatedQuery, useQuery } from "convex/react"
import { Loader2Icon, UsersIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { api } from "../../../../convex/_generated/api"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, LoadingState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { useDebounced } from "@/lib/use-debounced"
import { UsersFilters, type UsersFilterValue } from "./users-filters"
import { UsersList } from "./users-list"

const PAGE_SIZE = 20

/** /admin/users: filters + paginated list with "Load more". */
export function UsersSection() {
  const t = useTranslations("AdminUsers")
  const [filters, setFilters] = useState<UsersFilterValue>({ search: "", roleId: "", status: "" })
  const search = useDebounced(filters.search.trim())
  const roles = useQuery(api.admin.users.roleOptions, {})
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.users.list,
    {
      search: search || undefined,
      roleId: filters.roleId || undefined,
      status: filters.status || undefined,
    },
    { initialNumItems: PAGE_SIZE },
  )

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title={t("title")} />
      <UsersFilters value={filters} roles={roles} onChange={setFilters} />
      {status === "LoadingFirstPage" ? (
        <LoadingState />
      ) : results.length === 0 ? (
        <EmptyState icon={<UsersIcon />} title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <>
          <UsersList rows={results} />
          {status !== "Exhausted" ? (
            <Button
              variant="outline"
              className="self-center"
              disabled={status === "LoadingMore"}
              onClick={() => loadMore(PAGE_SIZE)}
            >
              {status === "LoadingMore" ? <Loader2Icon className="animate-spin" /> : null}
              {t("loadMore")}
            </Button>
          ) : null}
        </>
      )}
    </div>
  )
}
