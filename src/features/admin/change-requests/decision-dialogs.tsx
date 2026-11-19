"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { api } from "../../../../convex/_generated/api"
import type { Id } from "../../../../convex/_generated/dataModel"
import { DECISION_REASON_MAX } from "../../../../convex/lib/changeRequests"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { useErrorMessage } from "@/lib/use-error-message"
import { rejectSchema, type RejectValues } from "./schemas"

type RequestId = Id<"shopChangeRequests">

/**
 * Approve: applies the change now. Inside the cooldown the admin must tick
 * the override (the server checks it too and logs it).
 */
export function ApproveDialog({
  requestId,
  needsOverride,
  blocked,
}: {
  requestId: RequestId
  needsOverride: boolean
  /** The new link was taken meanwhile: approving would fail. */
  blocked: boolean
}) {
  const t = useTranslations("AdminChangeRequests")
  const tc = useTranslations("Common")
  const approve = useMutation(api.admin.changeRequests.approve)
  const errorMessage = useErrorMessage()
  const [open, setOpen] = useState(false)
  const [override, setOverride] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onApprove() {
    setBusy(true)
    try {
      await approve({ requestId, overrideCooldown: override })
      toast.success(t("approved"))
      setOpen(false)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={blocked}>
        {t("approve")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setOverride(false)
        }}
      >
        <DialogContent>
          <DialogTitle>{t("approveTitle")}</DialogTitle>
          <DialogDescription>{t("approveBody")}</DialogDescription>
          {needsOverride ? (
            <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                checked={override}
                onChange={(e) => setOverride(e.target.checked)}
                className="mt-0.5 size-4 accent-[var(--foreground)]"
              />
              <span>
                <span className="font-medium">{t("overrideCooldown")}</span>
                <span className="block text-muted-foreground">{t("overrideHelp")}</span>
              </span>
            </label>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={onApprove} disabled={busy || (needsOverride && !override)}>
              {busy ? t("approving") : t("approve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Reject with a reason the seller will read. Nothing changes on the shop. */
export function RejectDialog({ requestId }: { requestId: RequestId }) {
  const t = useTranslations("AdminChangeRequests")
  const tv = useTranslations("Validation")
  const tc = useTranslations("Common")
  const reject = useMutation(api.admin.changeRequests.reject)
  const errorMessage = useErrorMessage()
  const [open, setOpen] = useState(false)
  const form = useForm<RejectValues>({ resolver: zodResolver(rejectSchema(tv)), defaultValues: { reason: "" } })
  const { errors, isSubmitting } = form.formState

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {t("reject")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) form.reset()
        }}
      >
        <DialogContent>
          <DialogTitle>{t("rejectTitle")}</DialogTitle>
          <DialogDescription>{t("rejectBody")}</DialogDescription>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit(async ({ reason }) => {
              try {
                await reject({ requestId, reason })
                toast.success(t("rejected"))
                setOpen(false)
                form.reset()
              } catch (error) {
                toast.error(errorMessage(error))
              }
            })}
          >
            <Field id="reject-reason" label={t("rejectReason")} required error={errors.reason?.message}>
              {(p) => <Textarea {...p} rows={3} maxLength={DECISION_REASON_MAX} placeholder={t("rejectPlaceholder")} {...form.register("reason")} />}
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" variant="destructive" disabled={isSubmitting}>
                {isSubmitting ? t("rejecting") : t("reject")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
