"use client"

import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon, LockIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useCallback, useState } from "react"
import { cn } from "cn"
import type { Category } from "../../../../convex/lib/catalog"
import {
  DEFAULT_SECTIONS,
  FREE_LAYOUT,
  NEW_ARRIVALS_COUNT,
  sectionKey,
  sectionRows,
  type ProductLayout,
  type SectionEntry,
  type SectionsFacet,
} from "../../../../convex/lib/looks/sections"
import { RESTOCK_DAYS } from "../../../../convex/lib/restock"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useUpgradePlanName } from "@/features/billing/use-plan-catalog"
import { ChoiceGroup } from "./choice-group"
import { ProNote } from "./pro-note"
import { moveItem } from "./section-state"
import type { LookEditorState, MineLook } from "./use-look-editor"
import { useReorder } from "./use-reorder"

/**
 * Sections: which parts the shop page shows, in which order (drag the
 * handle, or the up / down buttons on phones and with a keyboard), the
 * product layout and the About and contact block. All of it is the
 * `sections` facet of the draft (CLAUDE.md "Shop looks"). Free publishes
 * "All products" in 2 columns and the About switch; the rest is shown
 * with a lock and can be tried in the draft.
 */
export function SectionsSection({
  editor,
  mine,
  disabled,
}: {
  editor: LookEditorState
  mine: MineLook
  disabled: boolean
}) {
  const t = useTranslations("LookEditor.shopSections")
  const tc = useTranslations("Categories")
  const tl = useTranslations("LookEditor.lock")
  const availableOn = tl("availableOn", { plan: useUpgradePlanName("featuredSections") })
  const entitled = mine.sectionsEntitled
  const facet = editor.draft.overrides.sections ?? DEFAULT_SECTIONS
  const rows = sectionRows(facet)
  const [announce, setAnnounce] = useState("")

  const write = useCallback(
    (patch: Partial<SectionsFacet>) =>
      editor.update((current) => {
        const base = current.overrides.sections ?? DEFAULT_SECTIONS
        return {
          ...current,
          overrides: { ...current.overrides, sections: { ...base, order: sectionRows(base), ...patch } },
        }
      }),
    [editor],
  )

  const label = (entry: SectionEntry) =>
    entry.id === "category" && entry.category ? tc(entry.category) : t(`names.${entry.id}`)

  const move = useCallback(
    (from: number, to: number) =>
      editor.update((current) => {
        const base = current.overrides.sections ?? DEFAULT_SECTIONS
        return { ...current, overrides: { ...current.overrides, sections: { ...base, order: moveItem(sectionRows(base), from, to) } } }
      }),
    [editor],
  )
  const { listRef, dragging, handleProps } = useReorder(move)

  function step(index: number, by: -1 | 1) {
    const to = index + by
    if (to < 0 || to >= rows.length) return
    move(index, to)
    setAnnounce(t("moved", { section: label(rows[index]), position: to + 1, total: rows.length }))
  }

  const setRow = (index: number, entry: SectionEntry | null) =>
    write({ order: entry ? rows.map((r, i) => (i === index ? entry : r)) : rows.filter((_, i) => i !== index) })

  const listed = new Set(rows.map(sectionKey))
  const addable = mine.categories.filter((c) => !listed.has(`category:${c}`))
  const addCategory = (category: Category) => {
    // Above "All products", so it shows before the full list.
    const allIndex = rows.findIndex((r) => r.id === "all")
    const order = [...rows]
    order.splice(allIndex === -1 ? order.length : allIndex, 0, { id: "category", on: true, category })
    write({ order })
  }

  const hint = (entry: SectionEntry) => {
    switch (entry.id) {
      case "sale":
        return mine.saleLive ? t("hints.saleLive") : t("hints.sale")
      case "newArrivals":
        return t("hints.newArrivals", { count: NEW_ARRIVALS_COUNT })
      case "featured":
        return t("hints.featured")
      case "backInStock":
        return t("hints.backInStock", { days: RESTOCK_DAYS })
      case "category":
        return t("hints.category")
      case "all":
        return t("hints.all")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">{t("listTitle")}</h3>
          <p className="text-xs text-muted-foreground">{t("listHelp")}</p>
        </div>
        <ol ref={listRef} className="flex flex-col gap-2" aria-label={t("listTitle")}>
          {rows.map((entry, index) => {
            const locked = !entitled && entry.id !== "all"
            const name = label(entry)
            return (
              <li
                key={sectionKey(entry)}
                data-reorder-row=""
                className={cn(
                  "flex items-center gap-1 rounded-lg border bg-card py-1 ps-1 pe-2 motion-safe:transition-shadow",
                  dragging === index && "shadow-float",
                  !entry.on && "bg-muted/40",
                )}
              >
                <span
                  {...handleProps(index)}
                  aria-hidden
                  className={cn(
                    "flex size-11 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground active:cursor-grabbing",
                    disabled && "pointer-events-none opacity-50",
                  )}
                >
                  <GripVerticalIcon className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col py-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <span className="truncate">{name}</span>
                    {locked ? (
                      <span title={availableOn} className="inline-flex shrink-0 items-center text-muted-foreground">
                        <LockIcon className="size-3" aria-hidden />
                        <span className="sr-only">{availableOn}</span>
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-pretty text-muted-foreground">{hint(entry)}</span>
                </div>
                <div className="flex shrink-0 items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 md:size-9"
                    disabled={disabled || index === 0}
                    aria-label={t("moveUp", { section: name })}
                    onClick={() => step(index, -1)}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 md:size-9"
                    disabled={disabled || index === rows.length - 1}
                    aria-label={t("moveDown", { section: name })}
                    onClick={() => step(index, 1)}
                  >
                    <ArrowDownIcon />
                  </Button>
                  {entry.id === "category" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 md:size-9"
                      disabled={disabled}
                      aria-label={t("remove", { section: name })}
                      onClick={() => setRow(index, null)}
                    >
                      <Trash2Icon />
                    </Button>
                  ) : null}
                  <Switch
                    checked={entry.on}
                    disabled={disabled}
                    aria-label={t("show", { section: name })}
                    onCheckedChange={(on) => setRow(index, { ...entry, on })}
                    className="ms-1"
                  />
                </div>
              </li>
            )
          })}
        </ol>
        <p className="sr-only" role="status" aria-live="polite">
          {announce}
        </p>
        {addable.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("addCategory")}</span>
            <div className="flex flex-wrap gap-2">
              {addable.map((category) => (
                <Button key={category} type="button" variant="outline" size="sm" disabled={disabled} onClick={() => addCategory(category)}>
                  <PlusIcon />
                  {tc(category)}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">{t("emptyNote")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <ChoiceGroup<ProductLayout>
          label={t("layout")}
          value={facet.layout}
          disabled={disabled}
          lockedLabel={availableOn}
          onChange={(layout) => write({ layout })}
          options={[
            { value: "grid2", label: t("layouts.grid2") },
            { value: "grid3", label: t("layouts.grid3"), locked: !entitled },
            { value: "large", label: t("layouts.large"), locked: !entitled },
          ]}
        />
        <p className="text-xs text-muted-foreground">{t("layoutHelp")}</p>
      </div>

      {!entitled && (facet.layout !== FREE_LAYOUT || rows.some((r) => r.on && r.id !== "all")) ? (
        <ProNote feature="featuredSections" />
      ) : null}

      <div className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium">{t("about")}</span>
          <span className="text-xs text-pretty text-muted-foreground">
            {t("aboutHelp")}{" "}
            <Link href="/dashboard/settings" className="font-medium text-foreground underline underline-offset-4">
              {t("aboutLink")}
            </Link>
          </span>
        </div>
        <Switch checked={facet.about} disabled={disabled} aria-label={t("about")} onCheckedChange={(about) => write({ about })} />
      </div>
    </div>
  )
}
