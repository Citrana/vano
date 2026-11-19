"use client"

import { useMutation } from "convex/react"
import { ClockIcon, LockIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "../../../convex/_generated/api"
import { inCooldown, type ProtectedField as Field } from "../../../convex/lib/changeRequests"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useNow } from "@/features/billing/use-billing"
import { useErrorMessage } from "@/lib/use-error-message"
import { ChangeRequestDialog } from "./change-request-dialog"
import { displayValue } from "./display-value"
import { useMyChangeRequests } from "./use-change-requests"

/**
 * A protected shop field in Shop settings: the live value, read-only,
 * with "Request a change", or the pending request and a cancel button.
 */
export function ProtectedField({
  field,
  label,
  current,
  country,
  disabled = false,
}: {
  field: Field
  label: string
  /** The live value (E.164 for WhatsApp). */
  current: string
  country: string
  /** A suspended shop can't ask. */
  disabled?: boolean
}) {
  const t = useTranslations("ChangeRequests")
  const format = useFormatter()
  const now = useNow()
  const errorMessage = useErrorMessage()
  const cancel = useMutation(api.changeRequests.cancel)
  const data = useMyChangeRequests()
  const [open, setOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const pending = data?.requests.find((r) => r.field === field && r.status === "pending")
  const labelId = `protected-${field}`

  async function onCancel() {
    if (!pending) return
    setCancelling(true)
    try {
      await cancel({ requestId: pending._id })
      toast.success(t("cancelled"))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="flex flex-col gap-2" role="group" aria-labelledby={labelId}>
      <span id={labelId} className="text-sm font-medium">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex min-h-11 min-w-0 flex-1 basis-48 items-center gap-2 rounded-md border bg-muted px-3 text-sm md:min-h-9">
          <LockIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate" title={displayValue(field, current)}>
            {displayValue(field, current)}
          </span>
        </p>
        {data === undefined ? (
          <Skeleton className="h-11 w-36 md:h-9" />
        ) : pending ? null : (
          <Button type="button" variant="outline" onClick={() => setOpen(true)} disabled={disabled}>
            {t("request")}
          </Button>
        )}
      </div>

      {pending ? (
        <div role="status" className="flex flex-col gap-2 rounded-lg bg-secondary p-3 text-sm">
          <p className="flex items-start gap-2">
            <ClockIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">{t("pending")}</span>{" "}
              {t("pendingBody", {
                value: displayValue(field, pending.newValue),
                date: format.dateTime(new Date(pending._creationTime), { dateStyle: "medium" }),
              })}
            </span>
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={onCancel}
            disabled={cancelling || disabled}
          >
            {t("cancelRequest")}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t(`help.${field}`)}</p>
      )}

      {data ? (
        <ChangeRequestDialog
          field={field}
          open={open}
          onOpenChange={setOpen}
          current={current}
          country={country}
          inCooldown={inCooldown(data.lastApproved[field], now)}
        />
      ) : null}
    </div>
  )
}
