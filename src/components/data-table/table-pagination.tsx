"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/ui/native-select"
import type { TablePages } from "./use-table-pages"
import { PAGE_SIZES, pageWindow } from "./url-state"

/**
 * "Showing 21–40 of 54", numbered pages and the page size. The total is
 * only known once the last page has loaded ("of 40+" until then).
 */
export function TablePagination({
  pages,
  page,
  size,
  onPage,
  onSize,
  sizes = PAGE_SIZES,
}: {
  pages: Pick<TablePages<unknown>, "loaded" | "total" | "pageCount" | "rows" | "loading">
  page: number
  size: number
  onPage: (page: number) => void
  onSize: (size: number) => void
  sizes?: readonly number[]
}) {
  const t = useTranslations("DataTable")
  if (pages.loading && pages.loaded === 0) return null
  const from = pages.rows.length === 0 ? 0 : (page - 1) * size + 1
  const to = (page - 1) * size + pages.rows.length
  const known = pages.pageCount ?? Math.ceil(pages.loaded / size)
  const hasNext = pages.pageCount === null || page < pages.pageCount
  const window = pageWindow(page, known, pages.pageCount === null)

  return (
    <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <p role="status" className="tabular-nums">
          {pages.total === null
            ? t("showingOpen", { from, to, loaded: pages.loaded })
            : t("showing", { from, to, total: pages.total })}
        </p>
        <label className="hidden items-center gap-2 sm:flex">
          <span className="whitespace-nowrap">{t("rowsPerPage")}</span>
          <NativeSelect value={size} onChange={(e) => onSize(Number(e.target.value))} className="w-20">
            {sizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>
      <nav aria-label={t("pagination")} className="flex items-center gap-1">
        <Button variant="ghost" size="icon" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeftIcon />
          <span className="sr-only">{t("previous")}</span>
        </Button>
        {window.map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} aria-hidden className="w-6 text-center text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={p}
              variant="ghost"
              size="icon"
              aria-current={p === page ? "page" : undefined}
              aria-label={t("page", { page: p })}
              onClick={() => onPage(p)}
              className={cn("hidden tabular-nums sm:inline-flex", p === page && "inline-flex bg-secondary font-semibold hover:bg-secondary")}
            >
              {p}
            </Button>
          ),
        )}
        <Button variant="ghost" size="icon" disabled={!hasNext || pages.loading} onClick={() => onPage(page + 1)}>
          <ChevronRightIcon />
          <span className="sr-only">{t("next")}</span>
        </Button>
      </nav>
    </div>
  )
}
