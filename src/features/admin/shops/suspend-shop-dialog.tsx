"use client"

import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "../../../../convex/_generated/api"
import type { Id } from "../../../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { useErrorMessage } from "@/lib/use-error-message"

/** Suspend or reactivate a shop, with a confirmation explaining the effect. */
export function SuspendShopDialog({ shopId, name, status }: { shopId: Id<"shops">; name: string; status: "active" | "suspended" }) {
  const t = useTranslations("AdminShops")
  const tc = useTranslations("Common")
  const setStatus = useMutation(api.admin.shops.setStatus)
  const errorMessage = useErrorMessage()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const suspending = status === "active"

  async function confirm() {
    setPending(true)
    try {
      await setStatus({ shopId, status: suspending ? "suspended" : "active" })
      toast.success(suspending ? t("suspended") : t("reactivated"))
      setOpen(false)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button variant={suspending ? "outline" : "default"} onClick={() => setOpen(true)}>
        {suspending ? t("suspend") : t("reactivate")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{suspending ? t("suspendTitle") : t("reactivateTitle")}</DialogTitle>
          <DialogDescription>{suspending ? t("suspendBody", { name }) : t("reactivateBody", { name })}</DialogDescription>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{tc("cancel")}</DialogClose>
            <Button onClick={confirm} disabled={pending}>
              {suspending ? t("suspend") : t("reactivate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
