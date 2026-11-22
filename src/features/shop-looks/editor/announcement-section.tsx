"use client"

import { useTranslations } from "next-intl"
import { useId, useState } from "react"
import { cn } from "cn"
import {
  ANNOUNCEMENT_TEXT_MAX,
  ANNOUNCEMENT_URL_MAX,
  cleanAnnouncementUrl,
  type AnnouncementFacet,
  type AnnouncementTone,
} from "../../../../convex/lib/looks/announcement"
import { cleanLine } from "../../../../convex/lib/looks/clean"
import { resolveAnnouncement } from "../../../../convex/lib/looks/resolve"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ShopLookScope } from "../look-scope"
import { ChoiceGroup } from "./choice-group"
import { ProNote } from "./pro-note"
import { ScheduleFields, useNow } from "./schedule-fields"
import type { LookEditorState, MineLook } from "./use-look-editor"

type LinkChoice = "none" | "sale" | "url"

/**
 * The announcement bar: one short line at the top of the shop, its link,
 * its colours (shop colours only) and optional dates, like an event
 * banner. The `announcement` facet of the draft (CLAUDE.md "Shop looks");
 * only valid text and links are written to it, so autosave never fails.
 */
export function AnnouncementSection({
  editor,
  mine,
  disabled,
}: {
  editor: LookEditorState
  mine: MineLook
  disabled: boolean
}) {
  const t = useTranslations("LookEditor.announcement")
  const id = useId()
  const now = useNow()
  const facet = editor.draft.overrides.announcement
  const set = (next: AnnouncementFacet | undefined) => editor.setOverride("announcement", next)
  const patch = (next: Partial<AnnouncementFacet>) =>
    editor.update((current) => {
      const announcement = current.overrides.announcement
      return announcement ? { ...current, overrides: { ...current.overrides, announcement: { ...announcement, ...next } } } : current
    })

  const [text, setText] = useState(facet?.text ?? "")
  const [url, setUrl] = useState(facet?.link?.kind === "url" ? facet.link.url : "")
  const [linkChoice, setLinkChoice] = useState<LinkChoice>(facet?.link?.kind ?? "none")
  const empty = cleanLine(text).length === 0
  const urlProblem = linkChoice === "url" && url.trim().length > 0 && cleanAnnouncementUrl(url) === null

  function turnOn(on: boolean) {
    if (!on) return set(undefined)
    const value = cleanLine(text).length > 0 ? text : t("defaultText")
    setText(value)
    setLinkChoice("none")
    set({ text: value, tone: "accent" })
  }

  function chooseLink(choice: LinkChoice) {
    setLinkChoice(choice)
    if (choice === "none") patch({ link: undefined })
    else if (choice === "sale") patch({ link: { kind: "sale" } })
    else {
      const clean = cleanAnnouncementUrl(url)
      patch({ link: clean ? { kind: "url", url: clean } : undefined })
    }
  }

  const tones: AnnouncementTone[] = ["accent", "dark", "soft"]
  const colors = editor.resolved.colors

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
        <span className="text-sm font-medium" id={`${id}-on`}>
          {t("show")}
        </span>
        <Switch checked={facet !== undefined} disabled={disabled} aria-labelledby={`${id}-on`} onCheckedChange={turnOn} />
      </div>

      {facet ? (
        <>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-text`} className="text-sm font-medium">
              {t("text")}
            </label>
            <Input
              id={`${id}-text`}
              value={text}
              maxLength={ANNOUNCEMENT_TEXT_MAX}
              disabled={disabled}
              placeholder={t("defaultText")}
              aria-invalid={empty || undefined}
              aria-describedby={`${id}-text-help`}
              onChange={(e) => {
                const next = e.target.value.replace(/[\r\n]+/g, " ")
                setText(next)
                if (cleanLine(next).length > 0) patch({ text: next })
              }}
            />
            <p id={`${id}-text-help`} className={cn("text-xs", empty ? "text-destructive" : "text-muted-foreground")}>
              {empty ? t("textRequired") : t("textCount", { count: text.length, max: ANNOUNCEMENT_TEXT_MAX })}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium" id={`${id}-tone`}>
              {t("colors")}
            </span>
            <div role="radiogroup" aria-labelledby={`${id}-tone`} className="grid gap-2">
              {tones.map((tone) => {
                const sample = resolveAnnouncement({ text, tone }, colors)
                const selected = facet.tone === tone
                return (
                  <button
                    key={tone}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={disabled}
                    onClick={() => patch({ tone })}
                    className={cn(
                      "flex min-h-11 flex-col gap-1.5 rounded-lg border p-2 text-start transition-colors focus-ring disabled:opacity-50",
                      selected ? "border-foreground" : "hover:bg-muted",
                    )}
                  >
                    <span className="text-xs font-medium">{t(`tones.${tone}`)}</span>
                    {sample ? (
                      <ShopLookScope look={editor.resolved} className="overflow-hidden rounded-md">
                        <span
                          className={cn(
                            "block truncate px-3 py-1.5 text-center text-xs font-medium",
                            tone === "accent" && "bg-primary text-primary-foreground",
                            tone === "dark" && "bg-foreground text-background",
                            tone === "soft" && "bg-[var(--chip-soft)] text-[var(--chip-soft-foreground)]",
                          )}
                        >
                          {cleanLine(text) || t("defaultText")}
                        </span>
                      </ShopLookScope>
                    ) : null}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">{t("colorsHelp")}</p>
          </div>

          <div className="flex flex-col gap-2">
            <ChoiceGroup<LinkChoice>
              label={t("link")}
              value={linkChoice}
              disabled={disabled}
              onChange={chooseLink}
              options={[
                { value: "none", label: t("links.none") },
                { value: "sale", label: t("links.sale") },
                { value: "url", label: t("links.url") },
              ]}
            />
            {linkChoice === "sale" ? (
              <p className="text-xs text-muted-foreground">{mine.saleLive ? t("saleLinkLive") : t("saleLinkHelp")}</p>
            ) : null}
            {linkChoice === "url" ? (
              <div className="flex flex-col gap-2">
                <label htmlFor={`${id}-url`} className="text-sm font-medium">
                  {t("url")}
                </label>
                <Input
                  id={`${id}-url`}
                  type="url"
                  inputMode="url"
                  value={url}
                  maxLength={ANNOUNCEMENT_URL_MAX}
                  disabled={disabled}
                  placeholder="https://"
                  aria-invalid={urlProblem || undefined}
                  aria-describedby={`${id}-url-help`}
                  onChange={(e) => {
                    setUrl(e.target.value)
                    const clean = cleanAnnouncementUrl(e.target.value)
                    patch({ link: clean ? { kind: "url", url: clean } : undefined })
                  }}
                />
                <p id={`${id}-url-help`} className={cn("text-xs", urlProblem ? "text-destructive" : "text-muted-foreground")}>
                  {urlProblem ? t("urlInvalid") : t("urlHelp")}
                </p>
              </div>
            ) : null}
          </div>

          <ScheduleFields
            schedule={facet}
            disabled={disabled}
            now={now}
            onCommit={(dates) => patch({ startsAt: dates.startsAt, endsAt: dates.endsAt })}
          />
        </>
      ) : null}

      {!mine.announcementEntitled && facet ? <ProNote feature="announcementBar" /> : null}
    </div>
  )
}
