"use client"

import { ImageIcon, LayoutTemplateIcon, PaletteIcon, SparklesIcon, SquareIcon, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import type { StaticImageData } from "next/image"
import type { LookOverrides, StoredLook } from "../../../../convex/lib/looks/validators"
import { BannerSection } from "./banner-section"
import { ButtonsSection } from "./buttons-section"
import { ColorsSection } from "./colors-section"
import { LooksSection } from "./looks-section"
import { PromoSection } from "./promo-section"
import { facetChanged, presetChanged } from "./section-state"
import type { LookEditorState, MineLook } from "./use-look-editor"

export type SectionProps = {
  editor: LookEditorState
  mine: MineLook
  disabled: boolean
  /** Product photos for the Looks tiles. */
  tiles: readonly (StaticImageData | string)[]
}

export type LookSection = {
  /** `?section=<key>`; labels in `LookEditor.sections.<key>` / `<key>Hint`. */
  key: string
  icon: LucideIcon
  Panel: (props: SectionProps) => ReactNode
  /** The draft differs from what's live in this section's part. */
  changed: (draft: StoredLook, live: StoredLook) => boolean
  /** The seller's plan doesn't include this section (publishing it is refused). */
  locked: (mine: MineLook) => boolean
  /** The override "Reset to preset" clears in this section, if any. */
  resets?: keyof LookOverrides
  /** Which banner the preview shows while this section is open. */
  previewBanner?: "event" | "normal"
}

/**
 * The "Shop look" sections, in order (CLAUDE.md "Shop looks"). A new
 * section (fonts, background, product cards, layout…) is one entry here,
 * its panel and its EN/FR labels: tabs, page address, dots, locks, the
 * phone sheet and the preview all read this list.
 */
export const LOOK_SECTIONS = [
  {
    key: "looks",
    icon: LayoutTemplateIcon,
    Panel: ({ editor, mine, disabled, tiles }) => (
      <LooksSection editor={editor} entitled={mine.entitled} disabled={disabled} tiles={tiles} />
    ),
    changed: presetChanged,
    locked: (mine) => !mine.entitled,
  },
  {
    key: "colors",
    icon: PaletteIcon,
    Panel: ({ editor, disabled }) => <ColorsSection editor={editor} disabled={disabled} />,
    changed: facetChanged("colors"),
    locked: (mine) => !mine.entitled,
    resets: "colors",
  },
  {
    key: "buttons",
    icon: SquareIcon,
    Panel: ({ editor, mine, disabled }) => <ButtonsSection editor={editor} entitled={mine.entitled} disabled={disabled} />,
    changed: facetChanged("buttons"),
    locked: (mine) => !mine.entitled,
    resets: "buttons",
  },
  {
    key: "banner",
    icon: ImageIcon,
    Panel: ({ editor, disabled }) => <BannerSection editor={editor} disabled={disabled} />,
    changed: facetChanged("banner"),
    locked: (mine) => !mine.entitled,
    resets: "banner",
    previewBanner: "normal",
  },
  {
    key: "events",
    icon: SparklesIcon,
    Panel: ({ editor, mine, disabled }) => <PromoSection editor={editor} mine={mine} disabled={disabled} />,
    changed: facetChanged("promo"),
    locked: (mine) => !mine.promoEntitled,
    previewBanner: "event",
  },
] as const satisfies readonly LookSection[]

export type SectionKey = (typeof LOOK_SECTIONS)[number]["key"]
export const SECTION_KEYS: readonly SectionKey[] = LOOK_SECTIONS.map((s) => s.key)
