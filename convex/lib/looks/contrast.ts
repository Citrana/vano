import { contrast, nudgeToContrast, type Hex } from "./color";
import type { EventPalette } from "./events";
import { glowStops, type ResolvedBanner, type ResolvedLook } from "./resolve";

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
 * palette; buttonDesign: a button design's label on its own fill (Glow).
 */
export type LookProblemTarget = "text" | "badge" | "chip" | "eventText" | "buttonDesign";

export type LookProblem = {
  target: LookProblemTarget;
  ratio: number;
  level: "warn" | "block";
  /** A colour that fixes it, applied to the seller's accent or background. */
  fix: { field: "accent" | "background"; value: Hex } | null;
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

const fixWith = (field: "accent" | "background", value: Hex | null): LookProblem["fix"] =>
  value === null ? null : { field, value };

/** Lowest contrast of an event palette's headline and second line on its background stops. */
export function eventTextContrast(palette: EventPalette): number {
  return Math.min(...palette.stops.flatMap((stop) => [contrast(palette.text, stop), contrast(palette.subText, stop)]));
}

export function lookProblems(
  look: Pick<ResolvedLook<unknown>, "colors" | "buttons"> & { banner?: ResolvedBanner<unknown> },
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

  return problems;
}

export function hasBlockingProblem(problems: readonly LookProblem[]): boolean {
  return problems.some((p) => p.level === "block");
}
