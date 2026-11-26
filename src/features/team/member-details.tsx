"use client"

import { useMutation } from "convex/react"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "../../../convex/_generated/api"
import { TEAM_ROLE_IDS, type TeamRole } from "../../../convex/lib/team"
import { DetailItem, DetailList } from "@/components/data-table/detail-list"
import { StatusTag } from "@/components/data-table/status-tag"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { NativeSelect } from "@/components/ui/native-select"
import { useErrorMessage } from "@/lib/use-error-message"
import { useRoleName } from "./role-label"
import type { MemberRow } from "./team-page"

/**
 * One member in the Team page drawer: change the role (saved at once),
 * suspend / reactivate, remove (asks first). Every change applies on the
 * member's next action; the server is the boundary.
 */
export function MemberDetails({ member, onRemoved }: { member: MemberRow; onRemoved: () => void }) {
  const t = useTranslations("Team.details")
  const tr = useTranslations("TeamRoles")
  const format = useFormatter()
  const roleName = useRoleName()
  const errorMessage = useErrorMessage()
  const changeRole = useMutation(api.team.changeRole)
  const setSuspended = useMutation(api.team.setSuspended)
  const remove = useMutation(api.team.removeMember)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const suspended = member.state === "suspended"

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true)
    try {
      await action()
      toast.success(done)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <DetailList>
        <DetailItem label={t("member")}>{member.label}</DetailItem>
        <DetailItem label={t("email")}>{member.email ?? "—"}</DetailItem>
        <DetailItem label={t("status")}>
          <StatusTag kind="member" status={member.state} />
        </DetailItem>
        <DetailItem label={t("joined")}>{format.dateTime(member.joinedAt, { dateStyle: "medium" })}</DetailItem>
      </DetailList>
      {member.state === "paused" ? <p className="text-sm text-muted-foreground">{t("pausedBody")}</p> : null}

      <Field id="member-role" label={t("role")} help={tr(`${member.role}.description`)}>
        {(p) => (
          <NativeSelect
            {...p}
            value={member.role}
            disabled={busy}
            onChange={(e) => {
              const role = e.target.value as TeamRole
              void run(() => changeRole({ memberId: member._id, role }), t("roleSaved", { role: roleName(role) }))
            }}
          >
            {TEAM_ROLE_IDS.map((id) => (
              <option key={id} value={id}>
                {roleName(id)}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            run(
              () => setSuspended({ memberId: member._id, suspended: !suspended }),
              suspended ? t("reactivated") : t("suspended"),
            )
          }
        >
          {suspended ? t("reactivate") : t("suspend")}
        </Button>
        <Button variant="destructive" disabled={busy} onClick={() => setConfirming(true)}>
          {t("remove")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("suspendHint")}</p>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogTitle>{t("removeTitle", { name: member.label })}</DialogTitle>
          <DialogDescription>{t("removeBody")}</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                await run(() => remove({ memberId: member._id }), t("removed"))
                setConfirming(false)
                onRemoved()
              }}
            >
              {t("removeConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
