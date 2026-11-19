"use client"

import { useQuery } from "convex/react"
import { AlertTriangleIcon, ExternalLinkIcon, FilePenLineIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"
import { api } from "../../../../convex/_generated/api"
import { inCooldown } from "../../../../convex/lib/changeRequests"
import type { Permission } from "../../../../convex/lib/permissions"
import { EmptyState, LoadingState } from "@/components/states/states"
import { Card, CardTitle } from "@/components/ui/card"
import { useNow } from "@/features/billing/use-billing"
import { displayValue } from "@/features/change-requests/display-value"
import { StatusTag } from "../data-table/status-tag"
import { adminHref } from "../shell/hrefs"
import { useAdminViewer } from "../shell/use-admin-viewer"
import { ChangeFlags } from "./change-request-badges"
import { ApproveDialog, RejectDialog } from "./decision-dialogs"

const DAY_MS = 86_400_000

/** The change request drawer: everything needed to decide, and the decision. */
export function ChangeRequestDetails({ requestId }: { requestId: string }) {
  const t = useTranslations("AdminChangeRequests")
  const tf = useTranslations("ChangeRequests.fieldName")
  const format = useFormatter()
  const now = useNow()
  const { viewer } = useAdminViewer()
  const data = useQuery(api.admin.changeRequests.get, { requestId })

  if (data === undefined || !viewer) return <LoadingState />
  if (data === null) return <EmptyState icon={<FilePenLineIcon />} title={t("notFoundTitle")} body={t("notFoundBody")} />

  const { request, shop } = data
  const can = (p: Permission) => viewer.permissions.includes(p)
  const date = (ms: number) => format.dateTime(new Date(ms), { dateStyle: "medium", timeStyle: "short" })
  const cooling = request.status === "pending" && inCooldown(data.lastApprovedAt, now)
  const slugGone = data.slugAvailable === false
  const item = (label: string, value: React.ReactNode) => (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{tf(request.field)}</CardTitle>
          <StatusTag kind="change" status={request.status} />
          <ChangeFlags flags={request.flags} matchedBrand={request.matchedBrand} />
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {item(t("oldValue"), displayValue(request.field, request.oldValue))}
          {item(t("newValue"), <span className="font-semibold">{displayValue(request.field, request.newValue)}</span>)}
          {request.status === "pending" && shop.currentValue !== request.oldValue
            ? item(t("currentValue"), displayValue(request.field, shop.currentValue))
            : null}
          {item(t("asked"), date(request._creationTime))}
        </dl>
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">{t("sellerReason")}</p>
          <p className="rounded-lg bg-muted p-3 text-sm break-words whitespace-pre-line">{request.reason}</p>
        </div>

        {request.status === "pending" ? (
          <div className="flex flex-col gap-2">
            {slugGone ? <Warning text={t("warnSlugTaken")} /> : null}
            {data.competingRequests > 0 ? <Warning text={t("warnCompeting", { count: data.competingRequests })} /> : null}
            {cooling && data.lastApprovedAt ? (
              <Warning text={t("warnCooldown", { date: date(data.lastApprovedAt) })} />
            ) : null}
            {request.flags.includes("brand") ? <Warning text={t("warnBrand", { brand: request.matchedBrand ?? "" })} /> : null}
          </div>
        ) : (
          <dl className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
            {request.decidedAt ? item(t("decided"), date(request.decidedAt)) : null}
            {request.decidedByEmail ? item(t("decidedBy"), request.decidedByEmail) : null}
            {request.decisionReason ? item(t("rejectReason"), request.decisionReason) : null}
            {request.cooldownOverridden ? item(t("cooldownOverridden"), t("yes")) : null}
          </dl>
        )}

        {request.status === "pending" && can("changeRequests.decide") ? (
          data.isOwnShop ? (
            <p className="text-sm text-muted-foreground">{t("ownShop")}</p>
          ) : (
            <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
              <RejectDialog requestId={request._id} />
              <ApproveDialog requestId={request._id} needsOverride={cooling} blocked={slugGone} />
            </div>
          )
        ) : null}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="truncate">{shop.name}</CardTitle>
          <StatusTag kind="shop" status={shop.status} />
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {item(
            t("shopLink"),
            <a href={`/${shop.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
              /{shop.slug}
              <ExternalLinkIcon className="size-3.5" aria-hidden />
            </a>,
          )}
          {item(t("owner"), shop.ownerEmail ?? "—")}
          {item(
            t("shopAge"),
            t("shopAgeValue", {
              days: Math.max(0, Math.floor((now - shop._creationTime) / DAY_MS)),
              date: format.dateTime(new Date(shop._creationTime), { dateStyle: "medium" }),
            }),
          )}
          {item(t("products"), shop.productCountCapped ? `${shop.productCount}+` : shop.productCount)}
        </dl>
        {can("shops.view") ? (
          <Link href={adminHref.shop(shop._id)} className="self-start text-sm font-medium hover:underline">
            {t("openShop")}
          </Link>
        ) : null}
      </Card>

      <Card aria-labelledby="past-requests-title">
        <CardTitle id="past-requests-title">{t("pastRequests")}</CardTitle>
        {data.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noPastRequests")}</p>
        ) : (
          <ul className="flex flex-col divide-y text-sm">
            {data.history.map((r) => (
              <li key={r._id}>
                <Link href={adminHref.changeRequest(r._id)} scroll={false} className="flex flex-col gap-1 py-2.5 hover:underline">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{tf(r.field)}</span>
                    <StatusTag kind="change" status={r.status} />
                  </span>
                  <span className="break-words text-muted-foreground">
                    {displayValue(r.field, r.oldValue)} → {displayValue(r.field, r.newValue)} · {date(r._creationTime)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function Warning({ text }: { text: string }) {
  return (
    <p role="status" className="flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm">
      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      {text}
    </p>
  )
}
