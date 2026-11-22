import { contrast, nudgeToContrast, type Hex } from "./color";
import type { EventPalette } from "./events";
import { glowStops, type ResolvedAnnouncement, type ResolvedBanner, type ResolvedLook, type ResolvedProfile } from "./resolve";

/**
 * Automatic contrast check (CLAUDE.md "Shop looks"). Runs in the editor
 * (warnings + one-tap fixes) and again in `shopLooks.publish`, which
 * refuses any "block". Thresholds follow WCAG 2 AA: 4.5:1 for text, 3:1
 * for large text and shape boundaries.
 */

export const TEXT_MIN = 4.5;
export const LARGE_MIN = 3;

/**
 * text: body text; badge: label on the chip colour; chip: selected chip vs
 * background; eventText: an event banner's headline / second line on its
 * palette; buttonDesign: a button design's label on its own fill (Glow);
 * profileBorder: the profile photo's border against the page background;
 * announcement: the Promo bar's text on its fill (both gradient stops).
 */
export type LookProblemTarget = "text" | "badge" | "chip" | "eventText" | "buttonDesign" | "profileBorder" | "announcement";

/**
 * What a one-tap fix changes: the accent, the background, the profile
 * border colour, or the Promo bar's custom text colour.
 */
export type LookFixField = "accent" | "background" | "profileBorder" | "announcementText";

export type LookProblem = {
  target: LookProblemTarget;
  ratio: number;
  level: "warn" | "block";
  /** A colour that fixes it, applied to the seller's accent, background or profile border. */
  fix: { field: LookFixField; value: Hex } | null;
};

function check(
  problems: LookProblem[],
  target: LookProblemTarget,
  ratio: number,
  warnBelow: number,
  blockBelow: number | null,
  fix: () => LookProblem["fix"],
) {
  if (ratio >= warnBelow) return;
  const level = blockBelow !== null && ratio < blockBelow ? "block" : "warn";
  problems.push({ target, ratio, level, fix: fix() });
}

const fixWith = (field: LookFixField, value: Hex | null): LookProblem["fix"] =>
  value === null ? null : { field, value };

/** Lowest contrast of an event palette's headline and second line on its background stops. */
export function eventTextContrast(palette: EventPalette): number {
  return Math.min(...palette.stops.flatMap((stop) => [contrast(palette.text, stop), contrast(palette.subText, stop)]));
}

export function lookProblems(
  look: Pick<ResolvedLook<unknown>, "colors" | "buttons"> & {
    banner?: ResolvedBanner<unknown>;
    profile?: ResolvedProfile;
    announcement?: ResolvedAnnouncement | null;
  },
): LookProblem[] {
  const c = look.colors;
  const problems: LookProblem[] = [];

  // Body and muted text are derived to pass; this only fails when even the
  // best of ink / cream can't (a mid-tone background).
  const text = Math.min(
    contrast(c.foreground, c.background),
    contrast(c.foreground, c.card),
    contrast(c.mutedForeground, c.background),
    contrast(c.mutedForeground, c.card),
    contrast(c.mutedForeground, c.muted),
  );
  check(problems, "text", text, TEXT_MIN, TEXT_MIN, () =>
    fixWith("background", nudgeToContrast(c.background, c.foreground, TEXT_MIN + 1.5)),
  );

  // Badges (sold out) and bold selected chips: label on the chip colour.
  check(problems, "badge", contrast(c.chipForeground, c.chip), TEXT_MIN, LARGE_MIN, () =>
    fixWith("accent", nudgeToContrast(c.chip, c.chipForeground, TEXT_MIN)),
  );
  // Outline chips put chip-coloured text on the background; solid ones
  // only need their shape to stand out.
  if (look.buttons.fill === "outline") {
    check(problems, "chip", contrast(c.chip, c.background), TEXT_MIN, LARGE_MIN, () =>
      fixWith("accent", nudgeToContrast(c.chip, c.background, TEXT_MIN)),
    );
  } else if (look.buttons.weight === "bold") {
    check(problems, "chip", contrast(c.chip, c.background), LARGE_MIN, null, () =>
      fixWith("accent", nudgeToContrast(c.chip, c.background, LARGE_MIN)),
    );
  }

  // Glow: the label on both gradient stops, for solid buttons and selected chips.
  if (look.buttons.design === "glow" && look.buttons.fill === "solid") {
    const ratio = Math.min(
      ...glowStops(c.primary, c.primaryForeground).map((stop) => contrast(c.primaryForeground, stop)),
      ...glowStops(c.chip, c.chipForeground).map((stop) => contrast(c.chipForeground, stop)),
    );
    check(problems, "buttonDesign", ratio, TEXT_MIN, LARGE_MIN, () =>
      fixWith("accent", nudgeToContrast(c.primary, c.primaryForeground, TEXT_MIN + 0.6)),
    );
  }

  // Event banner palettes are curated (and tested); this guards the data.
  if (look.banner?.kind === "event") {
    check(problems, "eventText", eventTextContrast(look.banner.palette), TEXT_MIN, LARGE_MIN, () => null);
  }

  // The profile border is a graphic, not text: 3:1 against the page (WCAG 1.4.11). A warning only.
  const border = look.profile?.border;
  if (border) {
    check(problems, "profileBorder", contrast(border.color, c.background), LARGE_MIN, null, () =>
      fixWith("profileBorder", nudgeToContrast(border.color, c.background, LARGE_MIN + 0.5)),
    );
  }

  // The Promo bar is small text on its fill: 4.5:1 on every stop. With a
  // shop colour tone the text is derived, so only a mid-tone accent can
  // fail; custom colours are the seller's pair, refused below 4.5:1.
  const bar = look.announcement;
  if (bar) {
    const stops = bar.gradientTo ? [bar.background, bar.gradientTo] : [bar.background];
    const ratio = Math.min(...stops.map((stop) => contrast(bar.foreground, stop)));
    if (bar.custom) {
      const darkest = stops.reduce((worst, stop) => (contrast(bar.foreground, stop) < contrast(bar.foreground, worst) ? stop : worst));
      check(problems, "announcement", ratio, TEXT_MIN, TEXT_MIN, () =>
        fixWith("announcementText", nudgeToContrast(bar.foreground, darkest, TEXT_MIN + 0.3)),
      );
    } else {
      check(problems, "announcement", ratio, TEXT_MIN, LARGE_MIN, () =>
        bar.tone === "accent"
          ? fixWith("accent", nudgeToContrast(c.primary, c.primaryForeground, TEXT_MIN + 0.3))
          : bar.tone === "soft"
            ? fixWith("accent", nudgeToContrast(c.chip, c.background, TEXT_MIN))
            : null,
      );
    }
  }

  return problems;
}

export function hasBlockingProblem(problems: readonly LookProblem[]): boolean {
  return problems.some((p) => p.level === "block");
}
