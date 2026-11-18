"use client"

import { CheckIcon, CopyIcon, LinkIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { cn } from "cn"

const COPIED_MS = 1800

/**
 * Sample shop-link card with a working copy button: copies the link and
 * plays a soft "Link copied" animation (static with reduced motion).
 */
export function LinkCopyCard({
  url,
  label,
  copyLabel,
  copiedLabel,
}: {
  url: string
  label: string
  copyLabel: string
  copiedLabel: string
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard blocked: it's a demo link, the feedback still plays.
    }
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS)
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-3 rounded-xl bg-card p-5 border shadow-float">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border bg-background px-3 py-2 ring-0 ring-success/30 transition-[box-shadow] duration-300 motion-reduce:transition-none",
          copied && "ring-2",
        )}
      >
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blush text-coral-strong">
          <LinkIcon className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-base font-semibold">{url}</span>
        <div className="relative shrink-0">
          {copied ? (
            <span
              aria-hidden
              className="absolute -top-10 left-1/2 -translate-x-1/2 animate-in rounded-full bg-ink px-3 py-1 text-xs font-semibold whitespace-nowrap text-cream duration-300 fade-in slide-in-from-bottom-1 motion-reduce:animate-none"
            >
              {copiedLabel}
            </span>
          ) : null}
          <button
            type="button"
            onClick={copy}
            aria-label={copyLabel}
            className={cn(
              "flex size-11 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors duration-300 hover:text-foreground focus-ring motion-reduce:transition-none",
              copied && "border-success/40 bg-success/15 text-whatsapp hover:text-whatsapp",
            )}
          >
            {copied ? (
              <CheckIcon key="check" className="size-4 animate-in duration-300 zoom-in-50 fade-in motion-reduce:animate-none" strokeWidth={3} aria-hidden />
            ) : (
              <CopyIcon key="copy" className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </div>
      <span role="status" className="sr-only">
        {copied ? copiedLabel : ""}
      </span>
    </div>
  )
}
