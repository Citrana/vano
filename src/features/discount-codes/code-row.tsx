"use client"

import { useMutation } from "convex/react"
import { MoreVerticalIcon, PauseIcon, PencilIcon, PlayIcon, Trash2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "../../../convex/_generated/api"
import type { SellerCode } from "../../../convex/discountCodes"
import { codeStatusAt } from "../../../convex/lib/discountCodes/active"
import type { Currency } from "../../../convex/lib/money"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { StatusTag } from "@/components/data-table/status-tag"
import { useErrorMessage } from "@/lib/use-error-message"
import { useCodeLabels } from "./use-code-labels"

export type CodeRowData = SellerCode & { products: number }

/**
 * One slim row in the seller's list: code, status, discount, where it
 * applies, uses, dates and its actions menu. Without the plan feature
 * (`locked`) only pause and delete are offered.
 */
export function CodeRow({ code, currency, now, locked }: { code: CodeRowData; currency: Currency; now: number; locked: boolean }) {
  const t = useTranslations("DiscountCodes")
  const tc = useTranslations("Common")
  const labels = useCodeLabels(currency)
  const errorMessage = useErrorMessage()
  const router = useRouter()
  const pause = useMutation(api.discountCodes.pause)
  const resume = useMutation(api.discountCodes.resume)
  const remove = useMutation(api.discountCodes.remove)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, setPending] = useState(false)
  const status = codeStatusAt(code, now)
  const paused = code.paused || code.adminPause !== null
  const over = status === "ended" || status === "usedUp"

  async function run(action: () => Promise<unknown>, done: string) {
    setPending(true)
    try {
      await action()
      toast.success(done)
      return true
    } catch (error) {
      toast.error(errorMessage(error))
      return false
    } finally {
      setPending(false)
    }
  }

  return (
    <li className="flex flex-col gap-1 py-1.5 ps-4 pe-1">
      <div className="flex items-center gap-3">
        {/* Phones: three short lines; computers: one line. */}
        <div className="grid min-w-0 flex-1 gap-x-4 gap-y-0.5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1.4fr)] md:items-center">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="min-w-0 truncate font-mono text-sm font-semibold tracking-wide">{code.code}</h2>
            <StatusTag kind="discountCode" status={status} />
          </div>
          <p className="truncate text-sm tabular-nums">
            {labels.discount(code.discount)} · {labels.where(code.target, code.products)}
          </p>
          <p className="truncate text-sm tabular-nums">{labels.uses(code.uses, code.maxUses)}</p>
          <p className="truncate text-xs text-muted-foreground">{labels.dates(code.startsAt, code.endsAt)}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label={t("actions", { code: code.code })} disabled={pending} />}
          >
            <MoreVerticalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-48">
            {!locked ? (
              <DropdownMenuItem className="min-h-11" onClick={() => router.push(`/dashboard/discount-codes/${code._id}`)}>
                <PencilIcon /> {tc("edit")}
              </DropdownMenuItem>
            ) : null}
            {!over && !paused ? (
              <DropdownMenuItem className="min-h-11" onClick={() => run(() => pause({ codeId: code._id }), t("pausedToast"))}>
                <PauseIcon /> {t("pause")}
              </DropdownMenuItem>
            ) : null}
            {status !== "ended" && paused && !locked ? (
              <DropdownMenuItem className="min-h-11" onClick={() => run(() => resume({ codeId: code._id }), t("resumedToast"))}>
                <PlayIcon /> {t("resume")}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="min-h-11 text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2Icon /> {tc("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {code.adminPause ? (
        <p role="note" className="pe-3 pb-1 text-xs text-destructive">
          {t("adminPaused", { reason: code.adminPause.reason })}
        </p>
      ) : null}
      {code.products === 0 ? <p className="pe-3 pb-1 text-xs text-tag-warning-foreground">{t("noProductsRow")}</p> : null}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogTitle>{t("deleteTitle")}</DialogTitle>
          <DialogDescription>{t("deleteBody", { code: code.code })}</DialogDescription>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{tc("cancel")}</DialogClose>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={pending}
              onClick={async () => {
                if (await run(() => remove({ codeId: code._id }), t("deleted"))) setConfirmDelete(false)
              }}
            >
              {pending ? tc("deleting") : tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  )
}
