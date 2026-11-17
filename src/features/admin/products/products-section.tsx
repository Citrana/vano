"use client"

import { usePaginatedQuery } from "convex/react"
import { Loader2Icon, PackageIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { api } from "../../../../convex/_generated/api"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, LoadingState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { useDebounced } from "@/lib/use-debounced"
import { ProductsFilters, type ProductsFilterValue } from "./products-filters"
import { ProductsList } from "./products-list"

const PAGE_SIZE = 20

/** /admin/products: filters + paginated list with "Load more". */
export function ProductsSection() {
  const t = useTranslations("AdminProducts")
  const [filters, setFilters] = useState<ProductsFilterValue>({ search: "", visibility: "", category: "" })
  const search = useDebounced(filters.search.trim())
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.products.list,
    {
      search: search || undefined,
      visibility: filters.visibility || undefined,
      category: filters.category || undefined,
    },
    { initialNumItems: PAGE_SIZE },
  )

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title={t("title")} />
      <ProductsFilters value={filters} onChange={setFilters} />
      {status === "LoadingFirstPage" ? (
        <LoadingState />
      ) : results.length === 0 && status === "Exhausted" ? (
        <EmptyState icon={<PackageIcon />} title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <>
          {results.length > 0 ? <ProductsList rows={results} /> : null}
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
