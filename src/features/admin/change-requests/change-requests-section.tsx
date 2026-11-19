"use client"

import { usePaginatedQuery } from "convex/react"
import { ChevronRightIcon, FilePenLineIcon, Loader2Icon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { api } from "../../../../convex/_generated/api"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, LoadingState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { dayRange } from "@/features/admin/billing/billing-filters"
import { displayValue } from "@/features/change-requests/display-value"
import { useDebounced } from "@/lib/use-debounced"
import { ChangeFlags, ChangeStatusBadge } from "./change-request-badges"
import { ChangeRequestsFilters, type ChangeRequestsFilterValue } from "./change-requests-filters"
import { changeRequestFiltersFromParams } from "./filter-params"

const PAGE_SIZE = 20

/**
 * /admin/change-requests: filters + paginated cards (one layout, phone
 * first). The URL can preset the filters (`?status=pending&flagged=1`);
 * a new URL resets them.
 */
export function ChangeRequestsSection() {
  const params = useSearchParams()
  return <ChangeRequestsView key={params.toString()} initial={changeRequestFiltersFromParams(params)} />
}

function ChangeRequestsView({ initial }: { initial: ChangeRequestsFilterValue }) {
  const t = useTranslations("AdminChangeRequests")
  const tf = useTranslations("ChangeRequests.fieldName")
  const format = useFormatter()
  const [filters, setFilters] = useState<ChangeRequestsFilterValue>(initial)
  const search = useDebounced(filters.search.trim())
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.changeRequests.list,
    {
      search: search || undefined,
      status: filters.status || undefined,
      field: filters.field || undefined,
      flagged: filters.flagged || undefined,
      ...dayRange(filters),
    },
    { initialNumItems: PAGE_SIZE },
  )

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title={t("title")} />
      <ChangeRequestsFilters value={filters} onChange={setFilters} />
      {status === "LoadingFirstPage" ? (
        <LoadingState />
      ) : results.length === 0 && status === "Exhausted" ? (
        <EmptyState icon={<FilePenLineIcon />} title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {results.map((row) => (
              <li key={row._id}>
                <Link
                  href={`/admin/change-requests/${row._id}`}
                  className="flex min-h-11 items-center gap-3 rounded-xl border bg-card p-3 hover:bg-muted md:p-4"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{tf(row.field)}</span>
                      <span className="truncate text-muted-foreground">· {row.shopName}</span>
                      <ChangeStatusBadge status={row.status} />
                      <ChangeFlags flags={row.flags} matchedBrand={row.matchedBrand} />
                    </span>
                    <span className="text-sm break-words">
                      <span className="text-muted-foreground">{displayValue(row.field, row.oldValue)}</span> →{" "}
                      <span className="font-medium">{displayValue(row.field, row.newValue)}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format.dateTime(new Date(row._creationTime), { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          {status !== "Exhausted" ? (
            <Button variant="outline" className="self-center" disabled={status === "LoadingMore"} onClick={() => loadMore(PAGE_SIZE)}>
              {status === "LoadingMore" ? <Loader2Icon className="animate-spin" /> : null}
              {t("loadMore")}
            </Button>
          ) : null}
        </>
      )}
    </div>
  )
}
