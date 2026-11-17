"use client"

import { usePaginatedQuery } from "convex/react"
import { Loader2Icon, StoreIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { api } from "../../../../convex/_generated/api"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, LoadingState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { useDebounced } from "@/lib/use-debounced"
import { ShopsFilters, type ShopsFilterValue } from "./shops-filters"
import { ShopsList } from "./shops-list"

const PAGE_SIZE = 20

/** /admin/shops: filters + paginated list with "Load more". */
export function ShopsSection() {
  const t = useTranslations("AdminShops")
  const [filters, setFilters] = useState<ShopsFilterValue>({ search: "", status: "", category: "", currency: "" })
  const search = useDebounced(filters.search.trim())
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.shops.list,
    {
      search: search || undefined,
      status: filters.status || undefined,
      category: filters.category || undefined,
      currency: filters.currency || undefined,
    },
    { initialNumItems: PAGE_SIZE },
  )

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title={t("title")} />
      <ShopsFilters value={filters} onChange={setFilters} />
      {status === "LoadingFirstPage" ? (
        <LoadingState />
      ) : results.length === 0 && status === "Exhausted" ? (
        <EmptyState icon={<StoreIcon />} title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <>
          {results.length > 0 ? <ShopsList rows={results} /> : null}
          {status !== "Exhausted" ? (
            // The category filter can return short pages: keep loading.
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
