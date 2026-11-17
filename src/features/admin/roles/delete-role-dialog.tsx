"use client"

import { useMutation } from "convex/react"
import { Trash2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "../../../../convex/_generated/api"
import type { Id } from "../../../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { useErrorMessage } from "@/lib/use-error-message"

/** Delete with confirmation; a role still assigned is refused by the server. */
export function DeleteRoleDialog({ roleId, name, inUse }: { roleId: Id<"roles">; name: string; inUse: boolean }) {
  const t = useTranslations("AdminRoles")
  const tc = useTranslations("Common")
  const remove = useMutation(api.admin.roles.remove)
  const errorMessage = useErrorMessage()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setPending(true)
    try {
      await remove({ roleId })
      toast.success(t("deleted"))
      setOpen(false)
      router.replace("/admin/roles")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <Trash2Icon />
        {t("delete")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{t("deleteTitle")}</DialogTitle>
          <DialogDescription>{inUse ? t("deleteInUse", { name }) : t("deleteBody", { name })}</DialogDescription>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{tc("cancel")}</DialogClose>
            {inUse ? null : (
              <Button className="bg-destructive text-white hover:bg-destructive/90" onClick={confirm} disabled={pending}>
                {pending ? tc("deleting") : tc("delete")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
