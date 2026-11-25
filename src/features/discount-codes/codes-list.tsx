"use client"

import { useQuery } from "convex/react"
import { PlusIcon, TicketPercentIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "cn"
import { api } from "../../../convex/_generated/api"
import { CODE_STATUSES, codeStatusAt, type CodeStatus } from "../../../convex/lib/discountCodes/active"
import { CODES_MAX } from "../../../convex/lib/discountCodes/rules"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, LoadingState } from "@/components/states/states"
import { buttonVariants } from "@/components/ui/button"
import { PlanLockCard } from "@/features/billing/plan-lock-card"
import { useNow } from "@/features/shop-looks/editor/schedule-fields"
import { CodeRow } from "./code-row"

type Filter = "all" | CodeStatus
const FILTERS: readonly Filter[] = ["all", ...CODE_STATUSES]
const isFilter = (v: string | null): v is Filter => v !== null && (FILTERS as readonly string[]).includes(v)

/** "Available on Business" + upgrade, for a shop whose plan has no codes. */
export function CodesLockCard({ hasCodes }: { hasCodes: boolean }) {
  const t = useTranslations("DiscountCodes.lock")
  return (
    <PlanLockCard
      feature="discountCodes"
      title={(plan) => t("title", { plan })}
      body={hasCodes ? t("bodyKept") : t("body")}
      action={(plan) => t("action", { plan })}
    />
  )
}

/**
 * The seller's Discount codes page (CLAUDE.md "Discount codes"): status
 * filter chips (in the address, `?status=`), the compact list with uses,
 * an empty state and, without the plan feature, the "Available on
 * Business" card (saved codes stay listed; they can be paused or deleted).
 */
export function CodesList() {
  const t = useTranslations("DiscountCodes")
  const data = useQuery(api.discountCodes.listMine, {})
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const now = useNow()
  const raw = params.get("status")
  const filter: Filter = isFilter(raw) ? raw : "all"

  if (data === undefined) return <LoadingState />
  const locked = !data.entitled
  const full = data.codes.length >= CODES_MAX
  const shown = filter === "all" ? data.codes : data.codes.filter((c) => codeStatusAt(c, now) === filter)

  const newButton = locked ? null : full ? (
    <span className="text-xs text-muted-foreground">{t("full")}</span>
  ) : (
    <Link href="/dashboard/discount-codes/new" className={buttonVariants()}>
      <PlusIcon />
      {t("new")}
    </Link>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageTitle title={t("title")} action={data.codes.length > 0 ? newButton : null} />
      {locked ? <CodesLockCard hasCodes={data.codes.length > 0} /> : null}
      {data.codes.length === 0 ? (
        locked ? null : (
          <EmptyState icon={<TicketPercentIcon />} title={t("emptyTitle")} body={t("emptyBody")} action={newButton} />
        )
      ) : (
        <>
          <div role="toolbar" aria-label={t("filterLabel")} className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
            {FILTERS.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => {
                  const next = new URLSearchParams(params)
                  if (key === "all") next.delete("status")
                  else next.set("status", key)
                  const qs = next.toString()
                  router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
                }}
                className="group flex min-h-11 shrink-0 items-center rounded-full focus-ring"
              >
                <span
                  className={cn(
                    "flex h-8 items-center rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors",
                    filter === key ? "chip-selected" : "bg-card group-hover:bg-muted",
                  )}
                >
                  {key === "all" ? t("filters.all") : t(`status.${key}`)}
                </span>
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("emptyFilter")}</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-xl border bg-card">
              {shown.map((code) => (
                <CodeRow key={code._id} code={code} currency={data.currency} now={now} locked={locked} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
