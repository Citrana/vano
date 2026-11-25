"use client"

import { useMutation, useQuery } from "convex/react"
import { TicketPercentIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { CODES_MAX } from "../../../convex/lib/discountCodes/rules"
import { PageTitle } from "@/components/shell/page-title"
import { EmptyState, ErrorState, LoadingState } from "@/components/states/states"
import { QueryBoundary } from "@/components/states/query-boundary"
import { buttonVariants } from "@/components/ui/button"
import { CodeEditor, type CodeSubmit } from "./code-editor"
import { CodesLockCard } from "./codes-list"

/**
 * The "New code" / "Edit code" pages. Editing sends the version the page
 * opened with, so a change made elsewhere meanwhile (another phone, an
 * admin pause) is reported (DISCOUNT_CODE_STALE) instead of overwritten.
 */
function EditorPage({ codeId }: { codeId?: string }) {
  const t = useTranslations("DiscountCodes")
  const tc = useTranslations("Common")
  const router = useRouter()
  const data = useQuery(api.discountCodes.editor, { codeId })
  const create = useMutation(api.discountCodes.create)
  const update = useMutation(api.discountCodes.update)

  const header = (
    <PageTitle title={codeId ? t("editTitle") : t("newTitle")} backHref="/dashboard/discount-codes" backLabel={tc("back")} />
  )
  if (data === undefined) return <LoadingState />
  if (codeId && data.code === null) {
    return (
      <div className="mx-auto max-w-2xl">
        {header}
        <EmptyState
          icon={<TicketPercentIcon />}
          title={t("notFound")}
          action={
            <Link href="/dashboard/discount-codes" className={buttonVariants({ variant: "outline" })}>
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
        <CodesLockCard hasCodes={data.codesCount > 0} />
      </div>
    )
  }
  if (!codeId && data.codesCount >= CODES_MAX) {
    return (
      <div className="mx-auto max-w-2xl">
        {header}
        <EmptyState icon={<TicketPercentIcon />} title={t("full")} />
      </div>
    )
  }
  const code = data.code

  return (
    <div className="mx-auto max-w-2xl">
      {header}
      <OpenedVersion
        key={code?._id ?? "new"}
        version={code?.version ?? null}
        render={(openedVersion) => (
          <CodeEditor
            currency={data.currency}
            categories={data.categories}
            products={data.products}
            initial={code}
            onSubmit={async (values: CodeSubmit) => {
              if (code) {
                await update({ codeId: code._id as Id<"discountCodes">, expectedVersion: openedVersion ?? code.version, ...values })
                toast.success(t("saved"))
              } else {
                await create(values)
                toast.success(t("created"))
              }
              router.push("/dashboard/discount-codes")
            }}
          />
        )}
      />
    </div>
  )
}

/** Keeps the version the page opened with, even when the live query updates. */
function OpenedVersion({ version, render }: { version: number | null; render: (openedVersion: number | null) => ReactNode }) {
  const [opened] = useState(version)
  return render(opened)
}

export function CodeEditorPage({ codeId }: { codeId?: string }) {
  return (
    <QueryBoundary fallback={(retry) => <ErrorState onRetry={retry} />}>
      <EditorPage codeId={codeId} />
    </QueryBoundary>
  )
}
