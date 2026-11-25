"use client"

import { useConvex, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ArrowDownIcon, ArrowUpIcon, DownloadIcon, ImageIcon, MinusIcon, PrinterIcon, ReceiptTextIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { cn } from "cn"
import { api } from "../../../convex/_generated/api"
import type { Category } from "../../../convex/lib/catalog"
import { minorToInput, type Currency } from "../../../convex/lib/money"
import {
  currentMonth,
  isMonth,
  monthRange,
  monthsBetween,
  previousMonth,
  REPORT_MAX,
  type Change,
} from "../../../convex/lib/salesRecords/report"
import type { SaleSource } from "../../../convex/lib/salesRecords/validators"
import { shopTimeZone } from "../../../convex/lib/timeZone"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, LoadingState } from "@/components/states/states"
import { StatTile } from "@/components/stats/stat-tile"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { NativeSelect } from "@/components/ui/native-select"
import { useRecordLabels } from "@/features/sales-records/use-record-labels"
import { toLocalInput } from "@/lib/local-time"
import { downloadText, toCsv } from "./csv"
import { DayBars, GroupBars } from "./report-charts"
import { ReportLock } from "./report-lock"

type Result = FunctionReturnType<typeof api.reports.month>
type Data = Extract<Result, { locked: false }>

/** "2026-11" → "November 2026" in the viewer's language. */
function useMonthLabel() {
  const format = useFormatter()
  return (month: string, style: "long" | "short" = "long") =>
    format.dateTime(new Date(`${month}-15T12:00:00Z`), {
      month: style,
      year: style === "long" ? "numeric" : undefined,
      timeZone: "UTC",
    })
}

/**
 * The seller's monthly report (CLAUDE.md "Sales tracking"): one month in
 * the shop's time zone (`?month=`), the plain-language line, key numbers
 * with the change versus last month, top products, sales by day / source
 * / category, WhatsApp taps versus sales, the CSV download and a
 * printable summary. Without `salesReports`: the lock card and an example.
 */
export function ReportsPage() {
  const shop = useQuery(api.shops.myShop, {})
  if (shop === undefined) return <LoadingState />
  if (shop === null) return null
  return <Report currency={shop.currency} timeZone={shopTimeZone(shop)} />
}

function Report({ currency, timeZone }: { currency: Currency; timeZone: string }) {
  const t = useTranslations("Reports")
  const monthLabel = useMonthLabel()
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [thisMonth] = useState(() => currentMonth(Date.now(), timeZone))
  const raw = params.get("month")
  const month = raw && isMonth(raw) && raw <= thisMonth ? raw : thisMonth
  const data = useQuery(api.reports.month, { month })
  // Keep the last report on screen while another month loads.
  const [last, setLast] = useState<Result | undefined>(data)
  if (data !== undefined && data !== last) setLast(data)
  const shown = data ?? last

  if (shown === undefined) return <LoadingState />
  if (shown.locked) {
    return (
      <div className="flex flex-col gap-5">
        <PageTitle title={t("title")} />
        <ReportLock kept={shown.kept} currency={currency} />
      </div>
    )
  }

  const first = shown.firstMonth && shown.firstMonth < thisMonth ? shown.firstMonth : thisMonth
  const months = monthsBetween(first, thisMonth)
  const empty = shown.summary.count === 0

  return (
    <div className="flex flex-col gap-5">
      <div data-print-hide className="flex flex-col gap-5">
        <PageTitle title={t("title")} action={!empty ? <ReportActions data={shown} /> : null} />
        <label className="flex flex-col gap-1.5 sm:max-w-60">
          <span className="text-sm font-medium">{t("month")}</span>
          <NativeSelect
            value={month}
            onChange={(e) => {
              const next = new URLSearchParams(params)
              if (e.target.value === thisMonth) next.delete("month")
              else next.set("month", e.target.value)
              const qs = next.toString()
              router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
            }}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </NativeSelect>
        </label>
        {empty ? (
          <EmptyState
            icon={<ReceiptTextIcon />}
            title={t("empty.title", { month: monthLabel(month) })}
            body={t("empty.body")}
            action={
              <Link href="/dashboard/sales" className={buttonVariants({ variant: "outline" })}>
                {t("empty.action")}
              </Link>
            }
          />
        ) : (
          <ReportBody data={shown} loading={data === undefined} />
        )}
      </div>
      {!empty ? <PrintSummary data={shown} /> : null}
    </div>
  )
}

/** "You sold 12 items for KSh 18,400, up 20% on October." */
function useSummaryLine() {
  const t = useTranslations("Reports.line")
  const monthLabel = useMonthLabel()
  return (data: Data, money: (minor: number) => string) => {
    const base = { items: data.summary.items, revenue: money(data.summary.revenue), previous: monthLabel(previousMonth(data.month), "short") }
    const change = data.changes.revenue
    if (data.previous.count === 0 || change.percent === null) return t("first", base)
    if (change.direction === "same") return t("same", base)
    return t(change.direction, { ...base, percent: change.percent })
  }
}

function ReportBody({ data, loading }: { data: Data; loading: boolean }) {
  const t = useTranslations("Reports")
  const tc = useTranslations("Categories")
  const ts = useTranslations("SalesRecords.sources")
  const monthLabel = useMonthLabel()
  const labels = useRecordLabels(data.currency, data.timeZone)
  const line = useSummaryLine()
  const previous = monthLabel(previousMonth(data.month), "short")
  const cards: { key: keyof Data["changes"]; value: string }[] = [
    { key: "revenue", value: labels.money(data.summary.revenue) },
    { key: "items", value: String(data.summary.items) },
    { key: "count", value: String(data.summary.count) },
    { key: "average", value: labels.money(data.summary.average) },
    { key: "discounts", value: labels.money(data.summary.discounts) },
  ]
  const cardLabel = { revenue: "revenue", items: "items", count: "sales", average: "average", discounts: "discounts" } as const

  return (
    <div className={cn("flex flex-col gap-5 transition-opacity motion-reduce:transition-none", loading && "opacity-60")} aria-busy={loading}>
      <p className="text-base font-medium sm:text-lg">{line(data, labels.money)}</p>
      {data.truncated ? <p className="text-xs text-muted-foreground">{t("truncated", { count: REPORT_MAX })}</p> : null}

      <dl aria-label={t("cards.label")} className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {cards.map(({ key, value }) => (
          <StatTile
            key={key}
            tone="card"
            label={t(`cards.${cardLabel[key]}`)}
            value={value}
            extra={<ChangeLine change={data.changes[key]} previous={previous} />}
          />
        ))}
      </dl>

      <div className="grid gap-5 lg:grid-cols-2">
        <TopProducts data={data} money={labels.money} />
        <Card className="gap-4">
          <CardTitle>{t("byDay.title")}</CardTitle>
          <DayBars days={data.byDay} money={labels.money} caption={t("byDay.caption", { month: monthLabel(data.month) })} />
        </Card>
        <Card className="gap-4">
          <CardTitle>{t("bySource.title")}</CardTitle>
          <GroupBars rows={data.bySource} label={(k) => ts(k as SaleSource)} money={labels.money} />
        </Card>
        <Card className="gap-4">
          <CardTitle>{t("byCategory.title")}</CardTitle>
          <GroupBars rows={data.byCategory} label={(k) => tc(k as Category)} money={labels.money} />
        </Card>
      </div>

      <TapsCard taps={data.taps} sales={data.summary.count} />
    </div>
  )
}

/** "▲ Up 20% from Oct" — an arrow and words, never color alone. */
function ChangeLine({ change, previous }: { change: Change; previous: string }) {
  const t = useTranslations("Reports.change")
  const Icon = change.direction === "up" ? ArrowUpIcon : change.direction === "down" ? ArrowDownIcon : MinusIcon
  const text =
    change.percent === null
      ? change.direction === "same"
        ? t("same", { month: previous })
        : t("new", { month: previous })
      : change.direction === "same"
        ? t("same", { month: previous })
        : t(change.direction, { percent: change.percent, month: previous })
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{text}</span>
    </span>
  )
}

function TopProducts({ data, money }: { data: Data; money: (minor: number) => string }) {
  const t = useTranslations("Reports.top")
  const [by, setBy] = useState<"revenue" | "pieces">("revenue")
  const rows = by === "revenue" ? data.topByRevenue : data.topByPieces
  const { from, to } = monthRange(data.month)
  return (
    <Card className="gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{t("title")}</CardTitle>
        <div role="tablist" aria-label={t("title")} className="inline-flex rounded-lg bg-muted p-0.5">
          {(["revenue", "pieces"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={by === key}
              onClick={() => setBy(key)}
              className={cn(
                "min-h-9 rounded-md px-3 text-xs font-medium focus-ring md:min-h-7",
                by === key ? "bg-card ring-1 ring-border" : "text-muted-foreground",
              )}
            >
              {key === "revenue" ? t("byRevenue") : t("byPieces")}
            </button>
          ))}
        </div>
      </div>
      <ol className="flex flex-col divide-y">
        {rows.map((p, i) => (
          <li key={p.productId}>
            <Link
              href={`/dashboard/sales?product=${p.productId}&from=${from}&to=${to}`}
              aria-label={t("open", { name: p.name })}
              className="flex min-h-12 items-center gap-3 py-2 hover:bg-muted/50 focus-ring"
            >
              <span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
              <span className="size-9 shrink-0 overflow-hidden rounded-md bg-muted">
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
                  <img src={p.photoUrl} alt="" className="size-full object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="size-4" aria-hidden />
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
              <span className="shrink-0 text-right text-sm tabular-nums">
                <span className="block font-semibold">{by === "revenue" ? money(p.revenue) : t("pieces", { count: p.items })}</span>
                <span className="block text-xs text-muted-foreground">{by === "revenue" ? t("pieces", { count: p.items }) : money(p.revenue)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  )
}

/** WhatsApp taps (from the shop stats) next to sales: counts only, never revenue. */
function TapsCard({ taps, sales }: { taps: number; sales: number }) {
  const t = useTranslations("Reports.taps")
  const ratio = sales > 0 && taps > 0 ? Math.max(1, Math.round(taps / sales)) : null
  return (
    <Card className="gap-3">
      <CardTitle>{t("title")}</CardTitle>
      <dl className="grid grid-cols-2 gap-2 sm:max-w-md">
        <StatTile label={t("taps")} value={taps.toLocaleString()} />
        <StatTile label={t("sales")} value={sales.toLocaleString()} />
      </dl>
      <p className="text-sm">{taps === 0 ? t("noTaps") : ratio !== null ? t("ratio", { taps: ratio }) : null}</p>
      <p className="text-xs text-muted-foreground">{t("note")}</p>
    </Card>
  )
}

/** Download CSV (confirmed sales of the month, from `salesRecords.listMine`) and Print. */
function ReportActions({ data }: { data: Data }) {
  const t = useTranslations("Reports")
  const tsrc = useTranslations("SalesRecords.sources")
  const convex = useConvex()
  const labels = useRecordLabels(data.currency, data.timeZone)
  const [pending, setPending] = useState(false)

  async function download() {
    setPending(true)
    try {
      const { from, to } = monthRange(data.month)
      const list = await convex.query(api.salesRecords.listMine, { from, to, status: "recorded", order: "asc" })
      if (list.locked) return
      const withCustomer = list.canSeeCustomers
      const headers = [
        t("csv.date"),
        t("csv.product"),
        t("csv.size"),
        t("csv.color"),
        t("csv.quantity"),
        t("csv.unitPrice"),
        t("csv.normalPrice"),
        t("csv.discount"),
        t("csv.total"),
        t("csv.currency"),
        t("csv.source"),
        t("csv.offer"),
        ...(withCustomer ? [t("csv.customerName"), t("csv.customerPhone")] : []),
      ]
      const rows = list.rows.map((r) => [
        toLocalInput(r.soldAt, data.timeZone).replace("T", " "),
        r.productName,
        r.size,
        r.color,
        r.quantity,
        minorToInput(r.finalUnitPrice),
        minorToInput(r.normalUnitPrice),
        minorToInput(r.discount),
        minorToInput(r.total),
        data.currency,
        tsrc(r.source),
        r.offer ? labels.offer(r.offer) : "",
        ...(withCustomer ? [r.customerName, r.customerPhone] : []),
      ])
      downloadText(toCsv(headers, rows), `${data.slug}-sales-${data.month}.csv`)
    } catch {
      toast.error(t("downloadFailed"))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="icon" className="sm:hidden" onClick={() => window.print()} aria-label={t("print")}>
        <PrinterIcon />
      </Button>
      <Button variant="outline" className="hidden sm:inline-flex" onClick={() => window.print()}>
        <PrinterIcon />
        {t("print")}
      </Button>
      <Button variant="outline" onClick={download} disabled={pending}>
        <DownloadIcon />
        <span className="hidden sm:inline">{t("download")}</span>
        <span className="sr-only sm:hidden">{t("download")}</span>
      </Button>
    </div>
  )
}

/** What Print / Save as PDF shows: shop, month, key numbers, top products. Hidden on screens. */
function PrintSummary({ data }: { data: Data }) {
  const t = useTranslations("Reports")
  const monthLabel = useMonthLabel()
  const labels = useRecordLabels(data.currency, data.timeZone)
  const line = useSummaryLine()
  const rows: [string, string][] = [
    [t("cards.revenue"), labels.money(data.summary.revenue)],
    [t("cards.items"), String(data.summary.items)],
    [t("cards.sales"), String(data.summary.count)],
    [t("cards.average"), labels.money(data.summary.average)],
    [t("cards.discounts"), labels.money(data.summary.discounts)],
    [t("taps.taps"), String(data.taps)],
  ]
  return (
    <section className="hidden flex-col gap-6 text-black print:flex">
      <header className="flex flex-col gap-1 border-b pb-4">
        <h1 className="font-heading text-2xl font-bold">{t("printTitle")}</h1>
        <p className="text-sm">{t("printMeta", { shop: data.shopName, month: monthLabel(data.month) })}</p>
      </header>
      <p className="text-base">{line(data, labels.money)}</p>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b">
              <th scope="row" className="py-2 text-left font-normal">
                {label}
              </th>
              <td className="py-2 text-right font-semibold tabular-nums">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="print-avoid-break flex flex-col gap-2">
        <h2 className="font-heading text-lg font-bold">{t("top.title")}</h2>
        <ol className="flex flex-col text-sm">
          {data.topByRevenue.map((p, i) => (
            <li key={p.productId} className="flex justify-between gap-4 border-b py-2">
              <span>
                {i + 1}. {p.name}
              </span>
              <span className="tabular-nums">
                {t("top.pieces", { count: p.items })} · {labels.money(p.revenue)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
