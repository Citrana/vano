"use client"

import { useMutation, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "../../../../convex/_generated/api"
import type { Id } from "../../../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { NativeSelect } from "@/components/ui/native-select"
import { useErrorMessage } from "@/lib/use-error-message"
import { useRoleLabel } from "../shell/use-admin-viewer"

/**
 * Role picker + confirmation. The super admin role is only offered to
 * super admins; escalation and other rules are enforced by the server.
 */
export function ChangeRoleForm({
  userId,
  email,
  currentRoleId,
  viewerIsSuperAdmin,
}: {
  userId: Id<"users">
  email: string
  currentRoleId: Id<"roles"> | null
  viewerIsSuperAdmin: boolean
}) {
  const t = useTranslations("AdminUsers")
  const tc = useTranslations("Common")
  const roles = useQuery(api.admin.users.roleOptions, {})
  const assignRole = useMutation(api.admin.users.assignRole)
  const errorMessage = useErrorMessage()
  const roleLabel = useRoleLabel()
  const [roleId, setRoleId] = useState<Id<"roles"> | "">(currentRoleId ?? "")
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const options = roles?.filter((r) => viewerIsSuperAdmin || r.key !== "super_admin") ?? []
  const picked = options.find((r) => r._id === roleId)

  async function confirm() {
    if (!roleId) return
    setPending(true)
    try {
      await assignRole({ userId, roleId })
      toast.success(t("roleChanged"))
      setOpen(false)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
        {t("changeRole")}
        <NativeSelect value={roleId} onChange={(e) => setRoleId(e.target.value as Id<"roles"> | "")} disabled={!roles}>
          {currentRoleId === null ? <option value="">{t("noRole")}</option> : null}
          {options.map((role) => (
            <option key={role._id} value={role._id}>
              {roleLabel(role)}
            </option>
          ))}
        </NativeSelect>
      </label>
      <Button onClick={() => setOpen(true)} disabled={!roleId || roleId === currentRoleId}>
        {t("saveRole")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{t("changeRoleTitle")}</DialogTitle>
          <DialogDescription>
            {t("changeRoleBody", { email, role: picked ? roleLabel(picked) : "" })}
          </DialogDescription>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{tc("cancel")}</DialogClose>
            <Button onClick={confirm} disabled={pending}>
              {t("saveRole")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
