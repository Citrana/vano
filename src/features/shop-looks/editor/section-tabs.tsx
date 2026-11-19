"use client"

import { Tabs } from "@base-ui/react/tabs"
import { LockIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"
import { LOOK_SECTIONS, type SectionKey } from "./sections"

export type SectionFlags = Record<SectionKey, { changed: boolean; locked: boolean }>

/**
 * The section list (a real tab list: arrow keys, Home / End, Enter or
 * Space opens). Vertical on desktop, a sideways-scrolling row on phones.
 * A dot = changes not published yet; a lock = not in the seller's plan.
 * Must sit inside the editor's `Tabs.Root`.
 */
export function SectionTabs({
  orientation,
  flags,
  onTabClick,
}: {
  orientation: "horizontal" | "vertical"
  flags: SectionFlags
  /** Phones: tapping a tab (even the open one) opens its sheet. */
  onTabClick?: (key: SectionKey) => void
}) {
  const t = useTranslations("LookEditor")
  const vertical = orientation === "vertical"
  return (
    <Tabs.List
      aria-label={t("sections.label")}
      activateOnFocus={false}
      className={cn(
        "flex gap-1",
        vertical ? "flex-col" : "no-scrollbar -mx-4 overflow-x-auto px-4 pb-1",
      )}
    >
      {LOOK_SECTIONS.map(({ key, icon: Icon }) => {
        const { changed, locked } = flags[key]
        const state = [changed ? t("tabs.changed") : null, locked ? t("tabs.pro") : null].filter(Boolean).join(", ")
        return (
          <Tabs.Tab
            key={key}
            value={key}
            onClick={() => onTabClick?.(key)}
            aria-label={state ? `${t(`sections.${key}`)}, ${state}` : undefined}
            className={cn(
              "relative inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              vertical ? "w-full justify-start border-transparent px-3 hover:bg-muted" : "rounded-full bg-card px-4 hover:bg-muted",
              // Active: a 1px border and a soft highlight (the ring is for keyboard focus only).
              "data-active:border-border data-active:bg-muted data-active:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className={vertical ? "flex-1 text-left" : undefined}>{t(`sections.${key}`)}</span>
            {locked ? <LockIcon className="size-3.5 shrink-0 opacity-70" aria-hidden /> : null}
            {changed ? <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary ring-2 ring-background" /> : null}
          </Tabs.Tab>
        )
      })}
    </Tabs.List>
  )
}
