"use client"

import { useMutation, useQuery } from "convex/react"
import { TagIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { SALES_MAX } from "../../../convex/lib/sales/rules"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, ErrorState, LoadingState } from "@/components/states/states"
import { QueryBoundary } from "@/components/states/query-boundary"
import { buttonVariants } from "@/components/ui/button"
import { SaleEditor, type SaleSubmit } from "./sale-editor"
import { SalesLockCard } from "./sales-list"

/**
 * The "New sale" / "Edit sale" pages. Editing sends the version the page
 * opened with, so a change made elsewhere meanwhile (another phone, an
 * admin pause) is reported (SALE_STALE) instead of overwritten.
 */
function EditorPage({ saleId }: { saleId?: string }) {
  const t = useTranslations("Sales")
  const tc = useTranslations("Common")
  const router = useRouter()
  const data = useQuery(api.sales.editor, { saleId })
  const create = useMutation(api.sales.create)
  const update = useMutation(api.sales.update)

  const title = saleId ? t("editTitle") : t("newTitle")
  const header = <PageTitle title={title} backHref="/dashboard/offers" backLabel={tc("back")} />
  if (data === undefined) return <LoadingState />
  if (saleId && data.sale === null) {
    return (
      <div className="mx-auto max-w-2xl">
        {header}
        <EmptyState
          icon={<TagIcon />}
          title={t("notFound")}
          action={
            <Link href="/dashboard/offers" className={buttonVariants({ variant: "outline" })}>
              {t("backToList")}
            </Link>
          }
        />
      </div>
    )
  }
  if (!data.entitled) {
    return (
      <div className="mx-auto max-w-2xl">
        {header}
        <SalesLockCard hasSales={data.salesCount > 0} />
      </div>
    )
  }
  if (!saleId && data.salesCount >= SALES_MAX) {
    return (
      <div className="mx-auto max-w-2xl">
        {header}
        <EmptyState icon={<TagIcon />} title={t("full")} />
      </div>
    )
  }
  const sale = data.sale

  return (
    <div className="mx-auto max-w-2xl">
      {header}
      <OpenedSale
        key={sale?._id ?? "new"}
        version={sale?.version ?? null}
        render={(openedVersion) => (
          <SaleEditor
            currency={data.currency}
            categories={data.categories}
            products={data.products}
            others={data.others}
            initial={sale}
            onSubmit={async (values: SaleSubmit) => {
              if (sale) {
                await update({ saleId: sale._id as Id<"sales">, expectedVersion: openedVersion ?? sale.version, ...values })
                toast.success(t("saved"))
              } else {
                await create(values)
                toast.success(t("created"))
              }
              router.push("/dashboard/offers")
            }}
          />
        )}
      />
    </div>
  )
}

/** Keeps the version the page opened with, even when the live query updates. */
function OpenedSale({ version, render }: { version: number | null; render: (openedVersion: number | null) => ReactNode }) {
  const [opened] = useState(version)
  return render(opened)
}

export function SaleEditorPage({ saleId }: { saleId?: string }) {
  return (
    <QueryBoundary fallback={(retry) => <ErrorState onRetry={retry} />}>
      <EditorPage saleId={saleId} />
    </QueryBoundary>
  )
}
