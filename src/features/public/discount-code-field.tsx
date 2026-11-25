"use client"

import { useMutation } from "convex/react"
import { CheckIcon, TicketPercentIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useId, useState, type FormEvent } from "react"
import { api } from "../../../convex/_generated/api"
import { CODE_MAX } from "../../../convex/lib/discountCodes/code"
import type { CodeProblem, CodeResult } from "../../../convex/lib/discountCodes/validators"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type AppliedCode = Extract<CodeResult, { status: "applied" }>

/**
 * "Have a discount code?" on the product page (CLAUDE.md "Discount
 * codes"), shown only when a live code applies to the product. The server
 * checks the code and computes the price (`public.checkDiscountCode`,
 * with the guessing limits); this only shows the result in the shop's
 * language. No animation.
 */
export function DiscountCodeField({
  productId,
  visitorId,
  applied,
  onApply,
  onRemove,
  problem,
  onProblem,
}: {
  productId: string
  visitorId: () => string
  applied: AppliedCode | null
  onApply: (code: AppliedCode) => void
  onRemove: () => void
  /** Shown under the field (also set by the Order button when a code stopped working). */
  problem: CodeProblem | "failed" | null
  onProblem: (problem: CodeProblem | "failed" | null) => void
}) {
  const t = useTranslations("Public.discountCode")
  const check = useMutation(api.public.checkDiscountCode)
  const [open, setOpen] = useState(problem !== null)
  const [text, setText] = useState("")
  const [pending, setPending] = useState(false)
  const id = useId()
  const messageId = `${id}-message`

  if (applied) {
    return (
      <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 text-sm" role="status">
        <span className="flex items-center gap-1.5 font-medium">
          <CheckIcon className="size-4 shrink-0" aria-hidden />
          {t("applied", { code: applied.code })}
        </span>
        <button
          type="button"
          onClick={() => {
            onRemove()
            setText("")
          }}
          className="min-h-11 underline underline-offset-4 focus-ring"
        >
          {t("remove")}
        </button>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-fit items-center gap-2 text-sm font-medium underline underline-offset-4 focus-ring"
      >
        <TicketPercentIcon className="size-4 shrink-0" aria-hidden />
        {t("prompt")}
      </button>
    )
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (text.trim() === "" || pending) return
    setPending(true)
    onProblem(null)
    try {
      const result = await check({ productId, code: text, visitorId: visitorId() })
      if (result.status === "applied") onApply(result)
      else onProblem(result.status)
    } catch {
      onProblem("failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs font-semibold tracking-wide uppercase">
        {t("label")}
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={CODE_MAX + 4}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={t("placeholder")}
          aria-invalid={problem !== null}
          aria-describedby={problem ? messageId : undefined}
          className="min-w-0 flex-1 font-mono tracking-wide uppercase"
        />
        <Button type="submit" variant="outline" className="shop-btn shrink-0" disabled={pending || text.trim() === ""}>
          {pending ? t("applying") : t("apply")}
        </Button>
      </div>
      <p id={messageId} aria-live="polite" className="min-h-4 text-sm text-[var(--muted-foreground)]">
        {problem ? t(`problems.${problem}`) : null}
      </p>
    </form>
  )
}
