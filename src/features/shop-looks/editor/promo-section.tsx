"use client"

import { useMutation } from "convex/react"
import { CalendarClockIcon, Loader2Icon, Trash2Icon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useId, useState } from "react"
import { toast } from "sonner"
import { cn } from "cn"
import { api } from "../../../../convex/_generated/api"
import { cleanLine, sameLook } from "../../../../convex/lib/looks/clean"
import {
  EVENT_FONT_IDS,
  EVENT_PALETTES,
  EVENT_TEMPLATE_IDS,
  EVENT_TEMPLATES,
  eventPaletteCss,
  PROMO_HEADLINE_MAX,
  PROMO_STICKERS_MAX,
  PROMO_SUBLINE_MAX,
  type EventTemplateId,
} from "../../../../convex/lib/looks/events"
import { resolveLook, type ResolvedEventBanner } from "../../../../convex/lib/looks/resolve"
import { promoStatusAt } from "../../../../convex/lib/looks/schedule"
import type { PromoFacet } from "../../../../convex/lib/looks/validators"
import { decorationForTemplate, DEFAULT_PROFILE } from "../../../../convex/lib/looks/profile"
import { STICKER_FILES } from "@/assets/images/stickers/files"
import { STICKER_CATEGORIES, STICKERS, type StickerId } from "@/assets/images/stickers/manifest"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useErrorMessage } from "@/lib/use-error-message"
import { BannerDownloads } from "../events/banner-downloads"
import { EventBanner } from "../events/event-banner"
import { EVENT_FONT_CLASS } from "../events/fonts"
import { useTemplateTexts } from "../events/use-template-texts"
import { ChoiceGroup, radioKeyDown } from "./choice-group"
import { MiniAvatar, type ProfileShopInfo } from "./profile-section"
import { ScheduleFields, useNow } from "./schedule-fields"
import type { LookEditorState, MineLook } from "./use-look-editor"

type Texts = ReturnType<typeof useTemplateTexts>

/** A template preview: the template in its first palette with its default text. */
function templateBanner(id: EventTemplateId, texts: Texts): ResolvedEventBanner {
  const template = EVENT_TEMPLATES[id]
  const paletteId = template.palettes[0]
  return {
    kind: "event",
    template: id,
    paletteId,
    palette: EVENT_PALETTES[paletteId],
    font: template.defaultFont,
    headline: texts(id).headline,
    subline: null,
    stickers: template.defaultStickers,
    height: "md",
  }
}

function newPromo(id: EventTemplateId, texts: Texts): PromoFacet {
  const template = EVENT_TEMPLATES[id]
  const { headline, subline } = texts(id)
  return {
    design: { template: id, palette: template.palettes[0], font: template.defaultFont, headline, subline, stickers: [...template.defaultStickers] },
    height: "md",
  }
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i])

/** Another template: what the seller changed is kept, defaults follow the new template. */
function switchTemplate(promo: PromoFacet, id: EventTemplateId, texts: Texts): PromoFacet {
  const { design } = promo
  const before = EVENT_TEMPLATES[design.template]
  const after = EVENT_TEMPLATES[id]
  const oldTexts = texts(design.template)
  const newTexts = texts(id)
  return {
    ...promo,
    design: {
      template: id,
      palette: after.palettes.includes(design.palette) ? design.palette : after.palettes[0],
      font: design.font === before.defaultFont ? after.defaultFont : design.font,
      headline: design.headline === oldTexts.headline ? newTexts.headline : design.headline,
      subline: (design.subline ?? "") === oldTexts.subline ? newTexts.subline : design.subline,
      stickers: sameList(design.stickers, before.defaultStickers) ? [...after.defaultStickers] : design.stickers,
    },
  }
}

function TemplateGrid({
  texts,
  selected,
  disabled,
  onPick,
}: {
  texts: Texts
  selected: EventTemplateId | null
  disabled: boolean
  onPick: (id: EventTemplateId) => void
}) {
  const t = useTranslations("EventBanners")
  const categories = ["promo", "season", "celebration", "announcement"] as const
  return (
    <div className="flex flex-col gap-4">
      {categories.map((category) => (
        <div key={category} className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t(`templateCategories.${category}`)}</h4>
          <div className="grid grid-cols-2 gap-2">
            {EVENT_TEMPLATE_IDS.filter((id) => EVENT_TEMPLATES[id].category === category).map((id) => (
              <button
                key={id}
                type="button"
                disabled={disabled}
                aria-pressed={selected === id}
                onClick={() => onPick(id)}
                className={cn(
                  "flex flex-col gap-1.5 rounded-lg border bg-card p-1.5 text-left focus-ring disabled:opacity-60",
                  selected === id && "tile-selected",
                )}
              >
                <span aria-hidden className="block aspect-[2.2/1] overflow-hidden rounded-md">
                  <EventBanner banner={templateBanner(id, texts)} format="wide" />
                </span>
                <span className="px-1 pb-0.5 text-sm font-medium">{t(`templates.${id}.name`)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** A text field that only writes valid text to the draft (an empty headline can't be saved). */
function LineField({
  label,
  value,
  max,
  required,
  disabled,
  onCommit,
}: {
  label: string
  value: string
  max: number
  required: boolean
  disabled: boolean
  onCommit: (value: string) => void
}) {
  const t = useTranslations("EventBanners")
  const id = useId()
  const [text, setText] = useState(value)
  // A template switch replaces the text from outside (typing echoes back the same text).
  const [synced, setSynced] = useState(value)
  if (value !== synced) {
    setSynced(value)
    if (cleanLine(text) !== cleanLine(value)) setText(value)
  }
  const empty = required && cleanLine(text).length === 0

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        value={text}
        maxLength={max}
        disabled={disabled}
        aria-invalid={empty || undefined}
        aria-describedby={`${id}-help`}
        onChange={(e) => {
          const next = e.target.value.replace(/[\r\n]+/g, " ")
          setText(next)
          if (!required || cleanLine(next).length > 0) onCommit(next)
        }}
      />
      <p id={`${id}-help`} className={cn("text-xs", empty ? "text-destructive" : "text-muted-foreground")}>
        {empty ? t("headlineRequired") : t("textCount", { count: text.length, max })}
      </p>
    </div>
  )
}

function PromoStatus({ mine, promo, now }: { mine: MineLook; promo: PromoFacet; now: number }) {
  const t = useTranslations("EventBanners.status")
  const format = useFormatter()
  const published = mine.published?.overrides.promo
  const date = (ms: number) => format.dateTime(new Date(ms), { dateStyle: "medium", timeStyle: "short" })
  let line: string
  if (!published) line = t("notPublished")
  else if (mine.promoHiddenByPlan) line = t("hidden")
  else {
    const status = promoStatusAt(published, now)
    line =
      status === "scheduled"
        ? t("scheduled", { date: date(published.startsAt!) })
        : status === "ended"
          ? t("ended", { date: date(published.endsAt!) })
          : published.endsAt !== undefined
            ? t("liveUntil", { date: date(published.endsAt) })
            : t("live")
  }
  const changed = published !== undefined && !sameLook(
    { v: 1, preset: "classic", overrides: { promo: published } },
    { v: 1, preset: "classic", overrides: { promo } },
  )
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" role="status">
      <CalendarClockIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="font-medium">{line}</span>
      {changed || !published ? <span className="text-muted-foreground">{t("publishToApply")}</span> : null}
    </p>
  )
}

/**
 * The "Event banners" section (CLAUDE.md "Shop looks"): pick a template, edit
 * text, colours, font, stickers and size, optionally schedule it, and
 * download it for WhatsApp / Instagram. It's part of the draft like the
 * rest of the look and shows instead of the normal banner while live.
 */
export function PromoSection({
  editor,
  mine,
  shop,
  disabled,
}: {
  editor: LookEditorState
  mine: MineLook
  shop: ProfileShopInfo
  disabled: boolean
}) {
  const t = useTranslations("EventBanners")
  const errorMessage = useErrorMessage()
  const texts = useTemplateTexts(mine.language)
  const endPromo = useMutation(api.shopLooks.endPromoNow)
  const now = useNow()
  const [choosing, setChoosing] = useState(false)
  const [ending, setEnding] = useState(false)
  const promo = editor.draft.overrides.promo
  const locked = !mine.promoEntitled
  const set = (next: PromoFacet | undefined) => editor.setOverride("promo", next)
  const setDesign = (patch: Partial<PromoFacet["design"]>) => promo && set({ ...promo, design: { ...promo.design, ...patch } })

  if (!promo || choosing) {
    return (
      <div className="flex flex-col gap-4">
        {!promo ? (
          <div className="flex flex-col gap-1 rounded-lg border border-dashed p-4">
            <p className="font-medium">{t("emptyTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("emptyBody")}</p>
          </div>
        ) : (
          <Button type="button" variant="outline" className="w-fit" onClick={() => setChoosing(false)}>
            {t("keepTemplate")}
          </Button>
        )}
        <TemplateGrid
          texts={texts}
          selected={promo?.design.template ?? null}
          disabled={disabled}
          onPick={(id) => {
            set(promo ? switchTemplate(promo, id, texts) : newPromo(id, texts))
            setChoosing(false)
          }}
        />
      </div>
    )
  }

  const { design } = promo
  const template = EVENT_TEMPLATES[design.template]
  const resolved = resolveLook({ v: 1, preset: "classic", overrides: { promo } }).banner as ResolvedEventBanner
  const publishedLive = mine.promoLive && mine.published?.overrides.promo !== undefined

  async function endNow() {
    setEnding(true)
    try {
      await endPromo({})
      toast.success(t("endNowDone"))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setEnding(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-lg border p-3">
        <div className="overflow-hidden rounded-md">
          <EventBanner banner={resolved} sizing="phone" />
        </div>
        <PromoStatus mine={mine} promo={promo} now={now} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            <span className="text-muted-foreground">{t("templateLabel")}: </span>
            <span className="font-medium">{t(`templates.${design.template}.name`)}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {publishedLive ? (
              <Button type="button" variant="outline" size="sm" disabled={disabled || ending} onClick={() => void endNow()}>
                {ending ? <Loader2Icon className="animate-spin" /> : null}
                {t("endNow")}
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setChoosing(true)}>
              {t("changeTemplate")}
            </Button>
          </div>
        </div>
      </div>

      <DecorationSuggestion editor={editor} shop={shop} promo={promo} disabled={disabled} />

      <LineField
        label={t("headline")}
        value={design.headline}
        max={PROMO_HEADLINE_MAX}
        required
        disabled={disabled}
        onCommit={(headline) => setDesign({ headline })}
      />
      <LineField
        label={t("subline")}
        value={design.subline ?? ""}
        max={PROMO_SUBLINE_MAX}
        required={false}
        disabled={disabled}
        onCommit={(subline) => setDesign({ subline })}
      />

      <div role="radiogroup" aria-label={t("colors")} className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("colors")}</span>
        <div className="flex flex-wrap gap-2">
          {template.palettes.map((paletteId, i) => {
            const selected = design.palette === paletteId
            return (
              <button
                key={paletteId}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={t(`palettes.${paletteId}`)}
                title={t(`palettes.${paletteId}`)}
                tabIndex={selected ? 0 : -1}
                disabled={disabled}
                onClick={() => setDesign({ palette: paletteId })}
                onKeyDown={(e) => radioKeyDown(e, i, template.palettes.length, (n) => setDesign({ palette: template.palettes[n] }))}
                className={cn(
                  "size-11 rounded-full border focus-ring",
                  selected && "tile-selected",
                )}
                style={{ backgroundImage: eventPaletteCss(EVENT_PALETTES[paletteId]) }}
              />
            )
          })}
        </div>
      </div>

      <div role="radiogroup" aria-label={t("font")} className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("font")}</span>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {EVENT_FONT_IDS.map((font, i) => {
            const selected = design.font === font
            return (
              <button
                key={font}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                disabled={disabled}
                onClick={() => setDesign({ font })}
                onKeyDown={(e) => radioKeyDown(e, i, EVENT_FONT_IDS.length, (n) => setDesign({ font: EVENT_FONT_IDS[n] }))}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2 focus-ring",
                  selected ? "chip-selected" : "bg-card hover:bg-muted",
                )}
              >
                <span aria-hidden className={cn("text-2xl leading-none", EVENT_FONT_CLASS[font])}>
                  {t("fontSample")}
                </span>
                <span className="text-xs">{t(`fonts.${font}`)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">{t("stickersTitle")}</legend>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {t("stickersHelp", { count: design.stickers.length, max: PROMO_STICKERS_MAX })}
          {design.stickers.length >= PROMO_STICKERS_MAX ? ` · ${t("stickersFull")}` : ""}
        </p>
        {STICKER_CATEGORIES.map((category) => (
          <div key={category} className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t(`stickerCategories.${category}`)}</span>
            <div className="flex flex-wrap gap-2">
              {STICKERS.filter((s) => s.category === category).map((sticker) => {
                const on = design.stickers.includes(sticker.id)
                const full = !on && design.stickers.length >= PROMO_STICKERS_MAX
                return (
                  <button
                    key={sticker.id}
                    type="button"
                    aria-pressed={on}
                    aria-label={t(`stickers.${sticker.id as StickerId}`)}
                    title={t(`stickers.${sticker.id as StickerId}`)}
                    disabled={disabled || full}
                    onClick={() =>
                      setDesign({ stickers: on ? design.stickers.filter((s) => s !== sticker.id) : [...design.stickers, sticker.id] })
                    }
                    className={cn(
                      "flex size-11 items-center justify-center rounded-lg border focus-ring disabled:opacity-40",
                      on ? "chip-selected" : "bg-card hover:bg-muted",
                    )}
                  >
                    <StickerIcon id={sticker.id} />
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </fieldset>

      <ChoiceGroup
        label={t("height")}
        value={promo.height}
        disabled={disabled}
        onChange={(height) => set({ ...promo, height })}
        options={[
          { value: "sm", label: t("small") },
          { value: "md", label: t("medium") },
          { value: "lg", label: t("large") },
        ]}
      />

      <ScheduleFields
        schedule={promo}
        disabled={disabled}
        now={now}
        onCommit={(dates) => set({ ...promo, startsAt: dates.startsAt, endsAt: dates.endsAt })}
      />

      <BannerDownloads banner={resolved} slug={mine.slug} locked={locked} />

      <div className="flex flex-col gap-1 border-t pt-4">
        <Button type="button" variant="ghost" className="w-fit text-destructive" disabled={disabled} onClick={() => set(undefined)}>
          <Trash2Icon />
          {t("remove")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("removeHint")}</p>
      </div>
    </div>
  )
}

/**
 * The profile decoration that goes with this event (Santa hat for
 * Christmas…), offered with one tap, never applied by itself. It takes the
 * banner's dates, so both turn on and off together.
 */
function DecorationSuggestion({
  editor,
  shop,
  promo,
  disabled,
}: {
  editor: LookEditorState
  shop: ProfileShopInfo
  promo: PromoFacet
  disabled: boolean
}) {
  const t = useTranslations("LookEditor.profile")
  const td = useTranslations("ProfileDecorations")
  const suggested = decorationForTemplate(promo.design.template)
  const profile = editor.draft.overrides.profile ?? DEFAULT_PROFILE
  if (!suggested || profile.decoration?.id === suggested) return null
  const name = td(`items.${suggested}`)
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <MiniAvatar editor={editor} shop={shop} profile={{ ...editor.resolved.profile, decoration: suggested }} className="size-16 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm">
          <span className="font-medium">{t("suggestTitle", { name })}</span>{" "}
          <span className="text-muted-foreground">{t("suggestBody")}</span>
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={disabled}
          onClick={() =>
            editor.setOverride("profile", { ...profile, decoration: { id: suggested, startsAt: promo.startsAt, endsAt: promo.endsAt } })
          }
        >
          {t("suggestApply")}
        </Button>
      </div>
    </div>
  )
}

/** A sticker drawn in the current text colour (for the picker). */
function StickerIcon({ id }: { id: StickerId }) {
  const src = STICKER_FILES[id].src
  const mask = `url("${src}") center / contain no-repeat`
  return <span aria-hidden className="size-6 bg-current" style={{ mask, WebkitMask: mask }} />
}
