"use client"

import { usePaginatedQuery } from "convex/react"
import { HistoryIcon, Loader2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { api } from "../../../../convex/_generated/api"
import { addDays, dayStartMs, isDay } from "../../../../convex/lib/days"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, LoadingState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { ActivityFilters, EMPTY_ACTIVITY_FILTERS, type ActivityFilterValue } from "./activity-filters"
import { ActivityList } from "./activity-list"

const PAGE_SIZE = 25

/** /admin/activity: who did what, to whom, when — newest first. */
export function ActivitySection() {
  const t = useTranslations("AdminActivity")
  const [filters, setFilters] = useState<ActivityFilterValue>(EMPTY_ACTIVITY_FILTERS)
  const filtered = Object.values(filters).some((value) => value !== "")
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.audit.list,
    {
      actor: filters.actor || undefined,
      action: filters.action || undefined,
      from: isDay(filters.from) ? dayStartMs(filters.from) : undefined,
      // "to" covers the whole picked day.
      to: isDay(filters.to) ? dayStartMs(addDays(filters.to, 1)) : undefined,
    },
    { initialNumItems: PAGE_SIZE },
  )

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title={t("title")} />
      <ActivityFilters value={filters} onChange={setFilters} />
      {status === "LoadingFirstPage" ? (
        <LoadingState />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<HistoryIcon />}
          title={filtered ? t("emptyFilteredTitle") : t("emptyTitle")}
          body={filtered ? t("emptyFilteredBody") : t("emptyBody")}
        />
      ) : (
        <>
          <ActivityList entries={results} />
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
