"use client"

import { ArrowRightIcon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useState, useSyncExternalStore } from "react"
import { cn } from "cn"
import type { ResolvedAnnouncement } from "../../../convex/lib/looks/resolve"

const TONE_CLASSES: Record<ResolvedAnnouncement["tone"], string> = {
  accent: "bg-primary text-primary-foreground",
  dark: "bg-foreground text-background",
  soft: "bg-[var(--chip-soft)] text-[var(--chip-soft-foreground)]",
}

/** A short key for "closed for this visit" (per shop and per text). */
function storageKey(slug: string, text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0
  return `vano.announcement.${slug}.${hash}`
}

/** Session storage doesn't notify this tab; closing updates local state instead. */
const subscribeNever = () => () => {}

function readClosed(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === "1"
  } catch {
    // Storage blocked: the bar just shows.
    return false
  }
}

/**
 * The shop's announcement bar (CLAUDE.md "Shop looks"): one short line at
 * the top, in shop colours (`ShopLookScope` tokens; contrast checked by
 * `lookProblems`). The visitor can close it for the visit (session
 * storage; it shows again in a new visit or when the text changes).
 * `preview`: inert, never closable (look editor).
 */
export function AnnouncementBar({
  announcement,
  slug,
  saleLive,
  preview = false,
}: {
  announcement: ResolvedAnnouncement
  slug: string
  /** The "sale" link only exists while a sale runs. */
  saleLive: boolean
  preview?: boolean
}) {
  const t = useTranslations("Public")
  const key = storageKey(slug, announcement.text)
  // The server (and the first client render) shows the bar; then the stored choice applies.
  const closedBefore = useSyncExternalStore(subscribeNever, () => !preview && readClosed(key), () => false)
  const [closedNow, setClosedNow] = useState(false)

  if (closedBefore || closedNow) return null

  function close() {
    setClosedNow(true)
    try {
      window.sessionStorage.setItem(key, "1")
    } catch {
      // Storage blocked: closed until the page reloads.
    }
  }

  const link = announcement.link
  const text = <span className="min-w-0 text-pretty">{announcement.text}</span>
  const arrow = <ArrowRightIcon className="size-3.5 shrink-0" aria-hidden />
  const linkClass = "inline-flex min-h-11 items-center justify-center gap-1.5 underline-offset-4 hover:underline focus-ring rounded-sm"
  let content = <span className="inline-flex min-h-11 items-center justify-center">{text}</span>
  if (!preview && link?.kind === "sale" && saleLive) {
    content = (
      <Link href={`/${slug}?sale=1#products`} className={linkClass}>
        {text}
        {arrow}
      </Link>
    )
  } else if (!preview && link?.kind === "url") {
    content = (
      <a href={link.url} target="_blank" rel="noopener noreferrer nofollow" className={linkClass}>
        {text}
        {arrow}
      </a>
    )
  } else if (preview && link && (link.kind === "url" || saleLive)) {
    content = (
      <span className={linkClass}>
        {text}
        {arrow}
      </span>
    )
  }

  return (
    <div role="region" aria-label={t("announcement.label")} className={cn("w-full", TONE_CLASSES[announcement.tone])}>
      <div className="mx-auto flex max-w-5xl items-center gap-2 ps-4 pe-1 text-center text-sm font-medium">
        <div className="flex min-w-0 flex-1 justify-center ps-10">{content}</div>
        {preview ? (
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center opacity-80">
            <XIcon className="size-4" />
          </span>
        ) : (
          <button
            type="button"
            onClick={close}
            aria-label={t("announcement.close")}
            className="flex size-11 shrink-0 items-center justify-center rounded-md opacity-80 hover:opacity-100 focus-ring"
          >
            <XIcon className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}
