"use client"

import { BanIcon, CalendarClockIcon, LockIcon, Trash2Icon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useId, useState } from "react"
import { cn } from "cn"
import { normalizeHex, type Hex } from "../../../../convex/lib/looks/color"
import {
  DECORATION_CATEGORIES,
  DEFAULT_PROFILE,
  isFreeProfile,
  PROFILE_BORDER_STYLES,
  PROFILE_BORDER_WIDTHS,
  PROFILE_COLOR_TOKENS,
  PROFILE_CORNERS,
  PROFILE_DECORATIONS,
  PROFILE_SHAPES,
  PROFILE_SIZES,
  type ProfileColorToken,
  type ProfileCorner,
  type ProfileDecorationId,
  type ProfileFacet,
} from "../../../../convex/lib/looks/profile"
import { resolveProfile, type ResolvedProfile } from "../../../../convex/lib/looks/resolve"
import { promoStatusAt } from "../../../../convex/lib/looks/schedule"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SHAPES } from "../events/shapes"
import { ShopLookScope } from "../look-scope"
import { profileLabelsFrom } from "../profile/labels"
import { ProfileAvatar } from "../profile/profile-avatar"
import { ChoiceGroup, radioKeyDown } from "./choice-group"
import { ContrastNotes } from "./contrast-notes"
import { ProNote } from "./pro-note"
import { ScheduleFields, useNow } from "./schedule-fields"
import type { LookEditorState, MineLook } from "./use-look-editor"

export type ProfileShopInfo = { name: string; logoUrl: string | null }

/** Would this change still be publishable on Free? (Same rule as the server: `isFreeProfile`.) */
const freeWith = (profile: ProfileFacet, patch: Partial<ProfileFacet>) => isFreeProfile({ ...profile, ...patch })

/** A small avatar in the draft look (for shape and decoration tiles). */
export function MiniAvatar({
  editor,
  shop,
  profile,
  className,
}: {
  editor: LookEditorState
  shop: ProfileShopInfo
  profile: ResolvedProfile
  className?: string
}) {
  const tp = useTranslations("Public")
  return (
    <ShopLookScope look={editor.resolved} className={cn("pointer-events-none flex items-center justify-center rounded-md", className)}>
      <ProfileAvatar profile={profile} photoUrl={shop.logoUrl} name={shop.name} labels={profileLabelsFrom(tp)} sizing="phone" className="size-11" />
    </ShopLookScope>
  )
}

function CornerIcon({ corner }: { corner: ProfileCorner }) {
  if (corner === "none") return <BanIcon className="size-5" aria-hidden />
  return (
    <svg viewBox="0 0 100 100" className="size-5" aria-hidden>
      <path d={SHAPES[corner].d} fill="currentColor" />
    </svg>
  )
}

/** Shop colours (follow the look) and a custom colour for the border. */
function BorderColorPicker({
  editor,
  profile,
  entitled,
  disabled,
  onChange,
}: {
  editor: LookEditorState
  profile: ProfileFacet
  entitled: boolean
  disabled: boolean
  onChange: (color: ProfileFacet["borderColor"]) => void
}) {
  const t = useTranslations("LookEditor.profile")
  const tl = useTranslations("LookEditor.lock")
  const id = useId()
  const { colors } = editor.resolved
  const tokenHex: Record<ProfileColorToken, Hex> = { accent: colors.primary, chip: colors.chip, foreground: colors.foreground }
  const value = profile.borderColor
  const customHex = value.kind === "custom" ? (value.hex as Hex) : tokenHex.accent
  const [hex, setHex] = useState<string>(customHex)
  const [seen, setSeen] = useState<string>(customHex)
  if (customHex !== seen) {
    setSeen(customHex)
    setHex(customHex)
  }
  const options = PROFILE_COLOR_TOKENS
  const index = value.kind === "theme" ? options.indexOf(value.token) : -1

  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">{t("borderColor")}</legend>
      <div role="radiogroup" aria-label={t("borderColor")} className="flex flex-wrap gap-2">
        {options.map((token, i) => {
          const selected = value.kind === "theme" && value.token === token
          return (
            <button
              key={token}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (index < 0 && i === 0) ? 0 : -1}
              onClick={() => onChange({ kind: "theme", token })}
              onKeyDown={(e) => radioKeyDown(e, i, options.length, (n) => onChange({ kind: "theme", token: options[n] }))}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-medium focus-ring",
                selected ? "chip-selected" : "bg-card hover:bg-muted",
              )}
            >
              <span aria-hidden className="size-5 rounded-full ring-1 ring-foreground/20" style={{ backgroundColor: tokenHex[token] }} />
              {t(`colorTokens.${token}`)}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium" htmlFor={`${id}-picker`}>
          <input
            id={`${id}-picker`}
            type="color"
            value={customHex}
            onChange={(e) => {
              const next = normalizeHex(e.target.value)
              if (next) onChange({ kind: "custom", hex: next })
            }}
            className="size-11 cursor-pointer rounded-md border bg-card p-1 focus-ring"
          />
          {t("customColor")}
          {!entitled ? <LockIcon className="size-3.5 opacity-70" aria-label={tl("availableOnPro")} /> : null}
        </label>
        <label htmlFor={`${id}-hex`} className="sr-only">
          {t("customColorHex")}
        </label>
        <Input
          id={`${id}-hex`}
          value={hex}
          autoComplete="off"
          spellCheck={false}
          maxLength={7}
          aria-invalid={normalizeHex(hex) === null || undefined}
          onChange={(e) => {
            setHex(e.target.value)
            const next = /^#?[0-9a-f]{6}$/i.test(e.target.value.trim()) ? normalizeHex(e.target.value) : null
            if (next) onChange({ kind: "custom", hex: next })
          }}
          onBlur={() => setHex(customHex)}
          className="w-28 font-mono uppercase"
        />
        {value.kind === "custom" ? <span className="text-xs text-muted-foreground">{t("customInUse")}</span> : null}
      </div>
    </fieldset>
  )
}

/** When the published decoration shows, and whether this draft changes it. */
function DecorationStatus({ mine, decorationId, now }: { mine: MineLook; decorationId: ProfileDecorationId; now: number }) {
  const t = useTranslations("EventBanners.status")
  const tp = useTranslations("LookEditor.profile")
  const format = useFormatter()
  const published = mine.published?.overrides.profile?.decoration
  const date = (ms: number) => format.dateTime(new Date(ms), { dateStyle: "medium", timeStyle: "short" })
  let line: string
  if (!published) line = t("notPublished")
  else if (mine.hiddenByPlan) line = tp("decorationHidden")
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
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" role="status">
      <CalendarClockIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="font-medium">{line}</span>
      {published?.id !== decorationId ? <span className="text-muted-foreground">{t("publishToApply")}</span> : null}
    </p>
  )
}

/**
 * The "Profile" section (CLAUDE.md "Shop looks" → "Profile"): the profile
 * photo's shape, border, size, position and overlap, a corner decoration,
 * and one decoration (crowns, events, everyday) that can be scheduled.
 * All of it is the `profile` facet of the draft, so draft, publish, the
 * unsaved dot and "Reset to preset" work as for any edit. Free can publish
 * a circle with a thin border in a shop colour; the rest shows a lock and
 * can still be tried in the preview.
 */
export function ProfileSection({
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
  const t = useTranslations("LookEditor.profile")
  const tl = useTranslations("LookEditor.lock")
  const td = useTranslations("ProfileDecorations")
  const now = useNow()
  const entitled = mine.entitled
  const profile: ProfileFacet = editor.draft.overrides.profile ?? DEFAULT_PROFILE
  const resolved = editor.resolved.profile
  const set = (patch: Partial<ProfileFacet>) => editor.setOverride("profile", { ...profile, ...patch })
  const locked = (patch: Partial<ProfileFacet>) => !entitled && !freeWith(profile, patch)
  const tile = (patch: Partial<ProfileFacet>) => resolveProfile({ ...profile, ...patch }, editor.resolved.colors)
  const decoration = profile.decoration
  const borderProblems = editor.problems.filter((p) => p.target === "profileBorder")
  const pickDecoration = (id: ProfileDecorationId | null) =>
    set({ decoration: id === null ? undefined : { id, startsAt: decoration?.startsAt, endsAt: decoration?.endsAt } })

  return (
    <div className="flex flex-col gap-6">
      {!entitled ? <ProNote /> : null}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium" id="profile-shape-label">
          {t("shape")}
        </span>
        <div role="radiogroup" aria-labelledby="profile-shape-label" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {PROFILE_SHAPES.map((shape, i) => {
            const selected = profile.shape === shape
            const isLocked = locked({ shape })
            return (
              <button
                key={shape}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={isLocked ? `${t(`shapes.${shape}`)}, ${tl("availableOnPro")}` : t(`shapes.${shape}`)}
                tabIndex={selected ? 0 : -1}
                disabled={disabled}
                onClick={() => set({ shape })}
                onKeyDown={(e) => radioKeyDown(e, i, PROFILE_SHAPES.length, (n) => set({ shape: PROFILE_SHAPES[n] }))}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border bg-card p-2 focus-ring disabled:opacity-60",
                  selected && "tile-selected",
                )}
              >
                <MiniAvatar editor={editor} shop={shop} profile={{ ...tile({ shape }), decoration: null, corner: "none" }} className="h-14 w-full" />
                <span className="flex items-center gap-1 text-xs font-medium">
                  {t(`shapes.${shape}`)}
                  {isLocked ? <LockIcon className="size-3 opacity-70" aria-hidden /> : null}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <BorderColorPicker
        editor={editor}
        profile={profile}
        entitled={entitled}
        disabled={disabled}
        onChange={(borderColor) => set({ borderColor })}
      />
      <ContrastNotes problems={borderProblems} onFix={editor.applyFix} disabled={disabled} />

      <ChoiceGroup
        label={t("borderWidth")}
        value={profile.borderWidth}
        disabled={disabled}
        lockedLabel={tl("availableOnPro")}
        onChange={(borderWidth) => set({ borderWidth })}
        options={PROFILE_BORDER_WIDTHS.map((w) => ({ value: w, label: t(`borderWidths.${w}`), locked: locked({ borderWidth: w }) }))}
      />
      <ChoiceGroup
        label={t("borderStyle")}
        value={profile.borderStyle}
        disabled={disabled || profile.borderWidth === "none"}
        lockedLabel={tl("availableOnPro")}
        onChange={(borderStyle) => set({ borderStyle })}
        options={PROFILE_BORDER_STYLES.map((s) => ({ value: s, label: t(`borderStyles.${s}`), locked: locked({ borderStyle: s }) }))}
      />
      <ChoiceGroup
        label={t("size")}
        value={profile.size}
        disabled={disabled}
        lockedLabel={tl("availableOnPro")}
        onChange={(size) => set({ size })}
        options={PROFILE_SIZES.map((s) => ({ value: s, label: t(`sizes.${s}`), locked: locked({ size: s }) }))}
      />
      <ChoiceGroup
        label={t("position")}
        value={profile.position}
        disabled={disabled}
        lockedLabel={tl("availableOnPro")}
        onChange={(position) => set({ position })}
        options={[
          { value: "start", label: t("positions.start"), locked: locked({ position: "start" }) },
          { value: "center", label: t("positions.center"), locked: locked({ position: "center" }) },
        ]}
      />
      <ChoiceGroup
        label={t("overlap")}
        value={profile.overlap}
        disabled={disabled}
        lockedLabel={tl("availableOnPro")}
        onChange={(overlap) => set({ overlap })}
        options={[
          { value: "edge", label: t("overlaps.edge"), locked: locked({ overlap: "edge" }) },
          { value: "below", label: t("overlaps.below"), locked: locked({ overlap: "below" }) },
        ]}
      />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium" id="profile-corner-label">
          {t("corner")}
        </span>
        <div role="radiogroup" aria-labelledby="profile-corner-label" className="flex flex-wrap gap-2">
          {PROFILE_CORNERS.map((corner, i) => {
            const selected = profile.corner === corner
            const isLocked = locked({ corner })
            const label = t(`corners.${corner}`)
            return (
              <button
                key={corner}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={isLocked ? `${label}, ${tl("availableOnPro")}` : label}
                title={isLocked ? `${label} · ${tl("availableOnPro")}` : label}
                tabIndex={selected ? 0 : -1}
                disabled={disabled}
                onClick={() => set({ corner })}
                onKeyDown={(e) => radioKeyDown(e, i, PROFILE_CORNERS.length, (n) => set({ corner: PROFILE_CORNERS[n] }))}
                className={cn(
                  "relative flex size-11 items-center justify-center rounded-lg border focus-ring",
                  selected ? "chip-selected" : "bg-card hover:bg-muted",
                )}
              >
                <CornerIcon corner={corner} />
                {isLocked ? <LockIcon className="absolute -top-1 -right-1 size-3.5 rounded-full bg-background p-0.5" aria-hidden /> : null}
              </button>
            )
          })}
        </div>
      </div>

      <section aria-labelledby="profile-decoration-title" className="flex flex-col gap-3 border-t pt-5">
        <div className="flex flex-col gap-1">
          <h3 id="profile-decoration-title" className="text-sm font-semibold">
            {t("decoration")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("decorationHelp")}</p>
        </div>
        <div className="flex flex-col gap-4">
          <button
            type="button"
            aria-pressed={!decoration}
            disabled={disabled}
            onClick={() => pickDecoration(null)}
            className={cn(
              "inline-flex min-h-11 w-fit items-center gap-2 rounded-full border px-4 text-sm font-medium focus-ring",
              !decoration ? "chip-selected" : "bg-card hover:bg-muted",
            )}
          >
            <BanIcon className="size-4" aria-hidden />
            {td("none")}
          </button>
          {DECORATION_CATEGORIES.map((category) => (
            <div key={category} className="flex flex-col gap-2">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{td(`categories.${category}`)}</span>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {PROFILE_DECORATIONS.filter((d) => d.category === category).map((entry) => {
                  const selected = decoration?.id === entry.id
                  const name = td(`items.${entry.id}`)
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      aria-pressed={selected}
                      aria-label={entitled ? name : `${name}, ${tl("availableOnPro")}`}
                      disabled={disabled}
                      onClick={() => pickDecoration(entry.id)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border bg-card px-1 pt-3 pb-1.5 focus-ring disabled:opacity-60",
                        selected && "tile-selected",
                      )}
                    >
                      <MiniAvatar editor={editor} shop={shop} profile={{ ...resolved, decoration: entry.id }} className="h-16 w-full" />
                      <span className="flex items-center gap-1 text-center text-xs leading-tight font-medium">
                        {name}
                        {!entitled ? <LockIcon className="size-3 shrink-0 opacity-70" aria-hidden /> : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {decoration ? (
          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <DecorationStatus mine={mine} decorationId={decoration.id} now={now} />
            <ScheduleFields
              key={decoration.id}
              schedule={decoration}
              disabled={disabled}
              now={now}
              onCommit={(dates) => set({ decoration: { id: decoration.id, startsAt: dates.startsAt, endsAt: dates.endsAt } })}
            />
            <Button type="button" variant="ghost" size="sm" className="w-fit text-destructive" disabled={disabled} onClick={() => pickDecoration(null)}>
              <Trash2Icon />
              {t("removeDecoration")}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
