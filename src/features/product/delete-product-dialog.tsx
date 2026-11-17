"use client"

import { useMutation } from "convex/react"
import { Trash2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { useErrorMessage } from "@/lib/use-error-message"

export function DeleteProductDialog({ productId, name }: { productId: Id<"products">; name: string }) {
  const t = useTranslations("Dashboard")
  const tc = useTranslations("Common")
  const remove = useMutation(api.products.remove)
  const errorMessage = useErrorMessage()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setPending(true)
    try {
      await remove({ productId })
      toast.success(t("deleted"))
      setOpen(false)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label={`${tc("delete")}: ${name}`}>
        <Trash2Icon />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{t("deleteTitle")}</DialogTitle>
          <DialogDescription>{t("deleteBody", { name })}</DialogDescription>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{tc("cancel")}</DialogClose>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirm}
              disabled={pending}
            >
              {pending ? tc("deleting") : tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
