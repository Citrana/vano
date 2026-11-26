"use client"

import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { MailIcon, PlusIcon, RefreshCwIcon, UsersRoundIcon, XIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { DataTable } from "@/components/data-table/data-table"
import { DetailsDrawer } from "@/components/data-table/details-drawer"
import { StatusTag } from "@/components/data-table/status-tag"
import type { Column } from "@/components/data-table/types"
import { useTableState } from "@/components/data-table/use-table-state"
import { PageTitle } from "@/components/shell/page-title"
import { LoadingState } from "@/components/states/states"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PlanLockCard } from "@/features/billing/plan-lock-card"
import { useNow } from "@/features/billing/use-billing"
import { useErrorMessage } from "@/lib/use-error-message"
import { InviteDialog, type MadeLink } from "./invite-dialog"
import { MemberDetails } from "./member-details"
import { RoleBadge } from "./role-label"
import { TEAM_SPEC } from "./table-spec"

type Overview = FunctionReturnType<typeof api.team.overview>
export type MemberRow = Overview["members"][number]

/** "Available on Business" + upgrade (CLAUDE.md "Team accounts"). */
function TeamLock({ hasMembers }: { hasMembers: boolean }) {
  const t = useTranslations("Team.lock")
  return (
    <PlanLockCard
      feature="teamRoles"
      title={(plan) => t("title", { plan })}
      body={hasMembers ? t("bodyKept") : t("body")}
      action={(plan) => t("action", { plan })}
    />
  )
}

/**
 * The owner's Team page: members (role, state, joined) in the shared list
 * with a drawer to change the role, suspend or remove; pending invites with
 * a new link / cancel; "Invite a member" while seats are left. Without the
 * plan feature: the lock card, members kept and shown as paused.
 */
export function TeamPage() {
  const t = useTranslations("Team")
  const overview = useQuery(api.team.overview, {})
  const shop = useQuery(api.shops.myShop, {})
  const table = useTableState(TEAM_SPEC)
  const now = useNow()
  const [inviting, setInviting] = useState(false)
  const [renewed, setRenewed] = useState<MadeLink | null>(null)

  if (overview === undefined || shop === undefined) return <LoadingState />
  const pending = overview.invites.filter((i) => i.expiresAt > now)
  const used = overview.members.length + pending.length
  const full = used >= overview.limit
  const shopName = shop?.name ?? ""

  const inviteButton = overview.entitled ? (
    full ? (
      <span className="text-xs text-muted-foreground">{t("full")}</span>
    ) : (
      <Button onClick={() => setInviting(true)}>
        <PlusIcon />
        {t("inviteButton")}
      </Button>
    )
  ) : null

  return (
    <div className="flex flex-col gap-5">
      <PageTitle title={t("title")} action={inviteButton} />
      {overview.entitled ? (
        <p className="-mt-3 text-sm text-muted-foreground">
          {t("seats", { used, limit: overview.limit })} · {t("ownerNote")}
        </p>
      ) : (
        <TeamLock hasMembers={overview.members.length > 0} />
      )}

      {overview.members.length > 0 || overview.entitled ? (
        <MembersTable rows={overview.members} table={table} onInvite={overview.entitled && !full ? () => setInviting(true) : undefined} />
      ) : null}

      {overview.invites.length > 0 ? (
        <Invites invites={overview.invites} now={now} onRenewed={setRenewed} />
      ) : null}

      <DetailsDrawer openId={table.open} onClose={table.closeRow} title={t("details.title")}>
        {(id) => {
          const member = overview.members.find((m) => m._id === id)
          return member ? <MemberDetails member={member} onRemoved={table.closeRow} /> : <LoadingState />
        }}
      </DetailsDrawer>

      <InviteDialog open={inviting} onOpenChange={setInviting} shopName={shopName} />
      <InviteDialog
        open={renewed !== null}
        onOpenChange={(open) => (open ? null : setRenewed(null))}
        shopName={shopName}
        made={renewed}
      />
    </div>
  )
}

function MembersTable({
  rows,
  table,
  onInvite,
}: {
  rows: MemberRow[]
  table: ReturnType<typeof useTableState>
  onInvite?: () => void
}) {
  const t = useTranslations("Team")
  const format = useFormatter()
  const columns: Column<MemberRow>[] = [
    {
      id: "member",
      header: t("columns.member"),
      mobile: "title",
      className: "max-w-64",
      cell: (m) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{m.label}</span>
          {m.email && m.email !== m.label ? <span className="truncate text-xs text-muted-foreground">{m.email}</span> : null}
        </span>
      ),
    },
    { id: "role", header: t("columns.role"), mobile: "subtitle", cell: (m) => <RoleBadge role={m.role} /> },
    {
      id: "joined",
      header: t("columns.joined"),
      muted: true,
      hideBelow: "lg",
      className: "whitespace-nowrap tabular-nums",
      cell: (m) => format.dateTime(m.joinedAt, { dateStyle: "medium" }),
    },
    { id: "status", header: t("columns.status"), mobile: "trailing", cell: (m) => <StatusTag kind="member" status={m.state} /> },
  ]
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{t("membersTitle")}</h2>
      <DataTable
        label={t("membersTitle")}
        columns={columns}
        rows={rows}
        getRowId={(m) => m._id}
        loading={false}
        stickyHeader={false}
        empty={{ icon: <UsersRoundIcon />, title: t("emptyTitle"), body: onInvite ? t("emptyBody") : undefined }}
        onRowOpen={(m) => table.openRow(m._id)}
        activeRowId={table.open}
      />
      {rows.some((m) => m.state === "paused") ? <p className="text-xs text-muted-foreground">{t("pausedHint")}</p> : null}
    </section>
  )
}

function Invites({
  invites,
  now,
  onRenewed,
}: {
  invites: Overview["invites"]
  now: number
  onRenewed: (link: MadeLink) => void
}) {
  const t = useTranslations("Team")
  const format = useFormatter()
  const errorMessage = useErrorMessage()
  const renew = useMutation(api.team.renewInvite)
  const revoke = useMutation(api.team.revokeInvite)
  const [busy, setBusy] = useState<Id<"shopInvites"> | null>(null)

  async function run(id: Id<"shopInvites">, action: () => Promise<void>) {
    setBusy(id)
    try {
      await action()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{t("invitesTitle")}</h2>
      <Card className="gap-0 divide-y p-0">
        {invites.map((invite) => {
          const expired = invite.expiresAt <= now
          return (
            <div key={invite._id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                  <MailIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{invite.email ?? t("linkOnly")}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <RoleBadge role={invite.role} />
                  <StatusTag kind="invite" status={expired ? "expired" : "pending"} />
                  {expired ? null : t("expires", { date: format.dateTime(invite.expiresAt, { dateStyle: "medium" }) })}
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy === invite._id}
                  onClick={() =>
                    run(invite._id, async () => {
                      const { token, emailSent } = await renew({ inviteId: invite._id })
                      onRenewed({ token, email: emailSent ? invite.email : null })
                    })
                  }
                >
                  <RefreshCwIcon />
                  {t("newLink")}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("cancelInvite")}
                  title={t("cancelInvite")}
                  disabled={busy === invite._id}
                  onClick={() =>
                    run(invite._id, async () => {
                      await revoke({ inviteId: invite._id })
                      toast.success(t("inviteCancelled"))
                    })
                  }
                >
                  <XIcon />
                </Button>
              </div>
            </div>
          )
        })}
      </Card>
    </section>
  )
}
