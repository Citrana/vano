"use client"

import {
  CircleUserRoundIcon,
  ImageIcon,
  LayoutListIcon,
  LayoutTemplateIcon,
  MegaphoneIcon,
  PaletteIcon,
  SparklesIcon,
  SquareIcon,
  type LucideIcon,
} from "lucide-react"
import type { ReactNode } from "react"
import type { StaticImageData } from "next/image"
import type { LookOverrides, StoredLook } from "../../../../convex/lib/looks/validators"
import type { FeatureFlag } from "../../../../convex/lib/planFeatures"
import { AnnouncementSection } from "./announcement-section"
import { BannerSection } from "./banner-section"
import { ButtonsSection } from "./buttons-section"
import { ColorsSection } from "./colors-section"
import { LooksSection } from "./looks-section"
import { ProfileSection, type ProfileShopInfo } from "./profile-section"
import { PromoSection } from "./promo-section"
import { SectionsSection } from "./sections-section"
import { facetChanged, presetChanged } from "./section-state"
import type { LookEditorState, MineLook } from "./use-look-editor"

export type SectionProps = {
  editor: LookEditorState
  mine: MineLook
  disabled: boolean
  /** Product photos for the Looks tiles. */
  tiles: readonly (StaticImageData | string)[]
  /** The shop's name and profile photo (Profile tiles, decoration suggestion). */
  shop: ProfileShopInfo
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
  /** The plan feature that unlocks it (names the plan in "Available on <plan>"). */
  lockedBy: FeatureFlag
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
    lockedBy: "allLooks",
  },
  {
    key: "colors",
    icon: PaletteIcon,
    Panel: ({ editor, disabled }) => <ColorsSection editor={editor} disabled={disabled} />,
    changed: facetChanged("colors"),
    locked: (mine) => !mine.entitled,
    lockedBy: "allLooks",
    resets: "colors",
  },
  {
    key: "buttons",
    icon: SquareIcon,
    Panel: ({ editor, mine, disabled }) => <ButtonsSection editor={editor} entitled={mine.entitled} disabled={disabled} />,
    changed: facetChanged("buttons"),
    locked: (mine) => !mine.entitled,
    lockedBy: "allLooks",
    resets: "buttons",
  },
  {
    key: "banner",
    icon: ImageIcon,
    Panel: ({ editor, disabled }) => <BannerSection editor={editor} disabled={disabled} />,
    changed: facetChanged("banner"),
    locked: (mine) => !mine.entitled,
    lockedBy: "allLooks",
    resets: "banner",
    previewBanner: "normal",
  },
  {
    key: "profile",
    icon: CircleUserRoundIcon,
    Panel: ({ editor, mine, shop, disabled }) => <ProfileSection editor={editor} mine={mine} shop={shop} disabled={disabled} />,
    changed: facetChanged("profile"),
    locked: (mine) => !mine.entitled,
    lockedBy: "allLooks",
    resets: "profile",
  },
  {
    key: "events",
    icon: SparklesIcon,
    Panel: ({ editor, mine, shop, disabled }) => <PromoSection editor={editor} mine={mine} shop={shop} disabled={disabled} />,
    changed: facetChanged("promo"),
    locked: (mine) => !mine.promoEntitled,
    lockedBy: "salesPromotions",
    previewBanner: "event",
  },
  {
    key: "sections",
    icon: LayoutListIcon,
    Panel: ({ editor, mine, disabled }) => <SectionsSection editor={editor} mine={mine} disabled={disabled} />,
    changed: facetChanged("sections"),
    locked: (mine) => !mine.sectionsEntitled,
    lockedBy: "featuredSections",
    resets: "sections",
  },
  {
    key: "announcement",
    icon: MegaphoneIcon,
    Panel: ({ editor, mine, disabled }) => <AnnouncementSection editor={editor} mine={mine} disabled={disabled} />,
    changed: facetChanged("announcement"),
    locked: (mine) => !mine.announcementEntitled,
    lockedBy: "announcementBar",
  },
] as const satisfies readonly LookSection[]

export type SectionKey = (typeof LOOK_SECTIONS)[number]["key"]
export const SECTION_KEYS: readonly SectionKey[] = LOOK_SECTIONS.map((s) => s.key)
