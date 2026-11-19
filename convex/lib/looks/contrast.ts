import { contrast, nudgeToContrast, type Hex } from "./color";
import type { ResolvedLook } from "./resolve";

/**
 * Automatic contrast check (CLAUDE.md "Shop looks"). Runs in the editor
 * (warnings + one-tap fixes) and again in `shopLooks.publish`, which
 * refuses any "block". Thresholds follow WCAG 2 AA: 4.5:1 for text, 3:1
 * for large text and shape boundaries.
 */

export const TEXT_MIN = 4.5;
export const LARGE_MIN = 3;

export type LookProblemTarget = "text" | "button" | "outline" | "badge" | "chip";

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

export function lookProblems(look: Pick<ResolvedLook<unknown>, "colors" | "buttons">): LookProblem[] {
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

  if (look.buttons.fill === "solid") {
    check(problems, "button", contrast(c.primaryForeground, c.primary), TEXT_MIN, LARGE_MIN, () =>
      fixWith("accent", nudgeToContrast(c.primary, c.primaryForeground, TEXT_MIN)),
    );
  } else {
    check(problems, "outline", contrast(c.primary, c.background), TEXT_MIN, LARGE_MIN, () =>
      fixWith("accent", nudgeToContrast(c.primary, c.background, TEXT_MIN)),
    );
  }

  check(problems, "badge", contrast(c.chipForeground, c.chip), TEXT_MIN, LARGE_MIN, () =>
    fixWith("accent", nudgeToContrast(c.chip, c.chipForeground, TEXT_MIN)),
  );
  check(problems, "chip", contrast(c.chip, c.background), LARGE_MIN, null, () =>
    fixWith("accent", nudgeToContrast(c.chip, c.background, LARGE_MIN)),
  );

  return problems;
}

export function hasBlockingProblem(problems: readonly LookProblem[]): boolean {
  return problems.some((p) => p.level === "block");
}
