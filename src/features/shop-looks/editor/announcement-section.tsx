"use client"

import { FlowerIcon, SparklesIcon, TagIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useId, useState } from "react"
import { cn } from "cn"
import {
  ANNOUNCEMENT_TEXT_MAX,
  ANNOUNCEMENT_TONES,
  ANNOUNCEMENT_URL_MAX,
  cleanAnnouncementUrl,
  PROMO_ICONS,
  PROMO_STYLES,
  PROMO_TITLE_MAX,
  type AnnouncementFacet,
  type AnnouncementTone,
  type PromoIcon,
  type PromoStyle,
} from "../../../../convex/lib/looks/announcement"
import type { Hex } from "../../../../convex/lib/looks/color"
import { ACCENT_SWATCHES } from "../../../../convex/lib/looks/presets"
import { CREAM, INK, resolveAnnouncement, WHITE } from "../../../../convex/lib/looks/resolve"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ChoiceGroup, radioKeyDown } from "./choice-group"
import { ColorPicker } from "./colors-section"
import { ContrastNotes } from "./contrast-notes"
import { ProNote } from "./pro-note"
import { ScheduleFields, useNow } from "./schedule-fields"
import type { LookEditorState, MineLook } from "./use-look-editor"

type LinkChoice = "none" | "sale" | "url"
type ColorChoice = AnnouncementTone | "custom"

const TEXT_SWATCHES: readonly Hex[] = [WHITE, CREAM, INK, "#000000"]
const ICON_ART = { tag: TagIcon, sparkle: SparklesIcon, flower: FlowerIcon } as const

/**
 * The Promo bar (CLAUDE.md "Shop looks"): one slim line under the shop
 * header that shows the running sale, else the seller's text. Its text
 * and link, the sale title, countdown and close switches, style, icon,
 * colours (shop colours, or the seller's background + text colours,
 * contrast checked) and optional dates. The `announcement` facet of the
 * draft; only valid values are written, so autosave never fails.
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
  const [title, setTitle] = useState(facet?.title ?? "")
  const [url, setUrl] = useState(facet?.link?.kind === "url" ? facet.link.url : "")
  const [linkChoice, setLinkChoice] = useState<LinkChoice>(facet?.link?.kind ?? "none")
  const urlProblem = linkChoice === "url" && url.trim().length > 0 && cleanAnnouncementUrl(url) === null

  function turnOn(on: boolean) {
    if (!on) {
      editor.setPromoPreviewSale(false)
      return set(undefined)
    }
    const value = text.trim().length > 0 ? text : t("defaultText")
    setText(value)
    setLinkChoice("none")
    set({ text: value, tone: "accent", icon: "tag" })
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

  const colors = editor.resolved.colors
  const colorChoice: ColorChoice = facet?.colors ? "custom" : (facet?.tone ?? "accent")

  function chooseColors(choice: ColorChoice) {
    if (!facet) return
    if (choice !== "custom") return patch({ tone: choice, colors: undefined })
    // Start from the shop colours the bar uses now.
    const current = resolveAnnouncement({ text: facet.text, tone: facet.tone }, colors)
    if (current) patch({ colors: { background: current.background, foreground: current.foreground } })
  }

  const barProblems = editor.problems.filter((p) => p.target === "announcement")
  const colorChoices: ColorChoice[] = [...ANNOUNCEMENT_TONES, "custom"]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium" id={`${id}-on`}>
            {t("show")}
          </span>
          <Switch checked={facet !== undefined} disabled={disabled} aria-labelledby={`${id}-on`} onCheckedChange={turnOn} />
        </div>
        <p className="text-xs text-muted-foreground">{t("intro")}</p>
      </div>

      {facet ? (
        <>
          <ChoiceGroup<"text" | "sale">
            label={t("previewAs")}
            value={editor.promoPreviewSale ? "sale" : "text"}
            onChange={(value) => editor.setPromoPreviewSale(value === "sale")}
            options={[
              { value: "text", label: t("previewText") },
              { value: "sale", label: t("previewSale") },
            ]}
          />

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
              aria-describedby={`${id}-text-help`}
              onChange={(e) => {
                const next = e.target.value.replace(/[\r\n]+/g, " ")
                setText(next)
                patch({ text: next })
              }}
            />
            <p id={`${id}-text-help`} className="text-xs text-muted-foreground">
              {t("textHelp")} {t("textCount", { count: text.length, max: ANNOUNCEMENT_TEXT_MAX })}
            </p>
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

          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-title`} className="text-sm font-medium">
              {t("saleTitle")}
            </label>
            <Input
              id={`${id}-title`}
              value={title}
              maxLength={PROMO_TITLE_MAX}
              disabled={disabled}
              placeholder={t("saleTitlePlaceholder")}
              aria-describedby={`${id}-title-help`}
              onChange={(e) => {
                const next = e.target.value.replace(/[\r\n]+/g, " ")
                setTitle(next)
                patch({ title: next.trim().length > 0 ? next : undefined })
              }}
            />
            <p id={`${id}-title-help`} className="text-xs text-muted-foreground">
              {t("saleTitleHelp")}
            </p>
          </div>

          <div className="flex flex-col divide-y rounded-lg border bg-card">
            <SwitchRow
              label={t("countdown")}
              hint={t("countdownHint")}
              checked={facet.countdown !== false}
              disabled={disabled}
              onChange={(on) => patch({ countdown: on ? undefined : false })}
            />
            <SwitchRow
              label={t("closable")}
              hint={t("closableHint")}
              checked={facet.closable !== false}
              disabled={disabled}
              onChange={(on) => patch({ closable: on ? undefined : false })}
            />
          </div>

          <ChoiceGroup<PromoStyle>
            label={t("style")}
            value={facet.style ?? "solid"}
            disabled={disabled}
            onChange={(style) => patch({ style: style === "solid" ? undefined : style })}
            options={PROMO_STYLES.map((style) => ({ value: style, label: t(`styles.${style}`) }))}
          />

          <ChoiceGroup<PromoIcon>
            label={t("icon")}
            value={facet.icon ?? "none"}
            disabled={disabled}
            onChange={(icon) => patch({ icon: icon === "none" ? undefined : icon })}
            options={PROMO_ICONS.map((icon) => {
              const Art = icon === "none" ? null : ICON_ART[icon]
              return { value: icon, label: t(`icons.${icon}`), icon: Art ? <Art className="size-4" aria-hidden /> : undefined }
            })}
          />

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium" id={`${id}-colors`}>
              {t("colors")}
            </span>
            <div role="radiogroup" aria-labelledby={`${id}-colors`} className="grid grid-cols-2 gap-2">
              {colorChoices.map((choice, i) => {
                const selected = colorChoice === choice
                const sample =
                  choice === "custom"
                    ? resolveAnnouncement({ ...facet, style: "solid" }, colors)
                    : resolveAnnouncement({ text: facet.text, tone: choice }, colors)
                return (
                  <button
                    key={choice}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    tabIndex={selected ? 0 : -1}
                    disabled={disabled}
                    onClick={() => chooseColors(choice)}
                    onKeyDown={(e) => radioKeyDown(e, i, colorChoices.length, (n) => chooseColors(colorChoices[n]))}
                    className={cn(
                      "flex min-h-11 flex-col gap-1.5 rounded-lg border p-2 text-start transition-colors focus-ring disabled:opacity-50",
                      selected ? "border-foreground" : "hover:bg-muted",
                    )}
                  >
                    <span className="text-xs font-medium">{choice === "custom" ? t("customColors") : t(`tones.${choice}`)}</span>
                    {sample ? (
                      // A sample of the bar, drawn with its resolved colours.
                      <span
                        className="block truncate rounded-sm px-3 py-1.5 text-center text-xs font-medium"
                        style={{ backgroundColor: sample.background, color: sample.foreground }}
                      >
                        {facet.text.trim() || t("defaultText")}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">{colorChoice === "custom" ? t("customColorsHelp") : t("colorsHelp")}</p>
            {facet.colors ? (
              <div className="flex flex-col gap-4 rounded-lg border p-3">
                <ColorPicker
                  label={t("background")}
                  swatches={ACCENT_SWATCHES}
                  value={facet.colors.background as Hex}
                  disabled={disabled}
                  onChange={(background) => facet.colors && patch({ colors: { ...facet.colors, background } })}
                />
                <ColorPicker
                  label={t("textColor")}
                  swatches={TEXT_SWATCHES}
                  value={facet.colors.foreground as Hex}
                  disabled={disabled}
                  onChange={(foreground) => facet.colors && patch({ colors: { ...facet.colors, foreground } })}
                />
              </div>
            ) : null}
            <ContrastNotes problems={barProblems} onFix={editor.applyFix} disabled={disabled} />
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

function SwitchRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  disabled: boolean
  onChange: (on: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-3 p-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium" id={`${id}-label`}>
          {label}
        </span>
        <span className="text-xs text-muted-foreground" id={`${id}-hint`}>
          {hint}
        </span>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        onCheckedChange={onChange}
      />
    </div>
  )
}
