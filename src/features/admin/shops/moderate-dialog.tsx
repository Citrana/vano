"use client"

import { useTranslations } from "next-intl"
import { useId, useState } from "react"
import { toast } from "sonner"
import { RESET_REASON_MAX, RESET_REASON_MIN, resetReasonProblem } from "../../../../convex/lib/looks/reset"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useErrorMessage } from "@/lib/use-error-message"

/**
 * Pause or delete one thing in a seller's shop (a sale, a discount code),
 * with a required reason: logged, and the seller is told. The server
 * checks the permission and the reason again.
 */
export function ModerateDialog({
  action,
  title,
  body,
  done,
  run,
}: {
  action: "pause" | "remove"
  title: string
  body: string
  done: string
  run: (reason: string) => Promise<unknown>
}) {
  const t = useTranslations("AdminShops.moderate")
  const tc = useTranslations("Common")
  const errorMessage = useErrorMessage()
  const reasonId = useId()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [pending, setPending] = useState(false)
  const invalid = resetReasonProblem(reason) !== null
  const label = action === "pause" ? t("pause") : tc("delete")

  async function confirm() {
    setPending(true)
    try {
      await run(reason)
      toast.success(done)
      setOpen(false)
      setReason("")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button variant={action === "pause" ? "outline" : "ghost"} size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
          <div className="flex flex-col gap-2">
            <Label htmlFor={reasonId} required>
              {t("reason")}
            </Label>
            <Textarea
              id={reasonId}
              required
              value={reason}
              maxLength={RESET_REASON_MAX}
              onChange={(e) => setReason(e.target.value)}
              aria-describedby={`${reasonId}-help`}
            />
            <p id={`${reasonId}-help`} className="text-xs text-muted-foreground">
              {t("reasonHelp", { min: RESET_REASON_MIN, max: RESET_REASON_MAX })}
            </p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{tc("cancel")}</DialogClose>
            <Button variant="destructive" onClick={confirm} disabled={pending || invalid}>
              {label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
