/**
 * Tiny colour helpers for shop looks (CLAUDE.md "Shop looks"): hex parsing,
 * WCAG relative luminance and contrast, mixing and lightness nudges. Pure,
 * no dependency, shared by the editor and the server.
 */

/** "#rrggbb", lowercase. */
export type Hex = `#${string}`;

const HEX_RE = /^#[0-9a-f]{6}$/;

export function isHex(value: string): value is Hex {
  return HEX_RE.test(value);
}

/** Accepts "#RGB", "#RRGGBB" (any case, optional "#"); returns "#rrggbb" or null. */
export function normalizeHex(value: string): Hex | null {
  let s = value.trim().toLowerCase();
  if (!s.startsWith("#")) s = `#${s}`;
  if (/^#[0-9a-f]{3}$/.test(s)) s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return isHex(s) ? s : null;
}

type Rgb = [number, number, number];

function toRgb(hex: Hex): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): Hex {
  const c = (x: number) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2 relative luminance, 0 (black) – 1 (white). */
export function luminance(hex: Hex): number {
  const [r, g, b] = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2 contrast ratio, 1 – 21. */
export function contrast(a: Hex, b: Hex): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Rounded down to 2 decimals for display ("4.49" never shows as "4.5"). */
export function ratioLabel(ratio: number): string {
  return (Math.floor(ratio * 100) / 100).toFixed(2);
}

/** Linear mix in sRGB: `amount` 0 = a, 1 = b. */
export function mix(a: Hex, b: Hex, amount: number): Hex {
  const ra = toRgb(a);
  const rb = toRgb(b);
  return toHex([0, 1, 2].map((i) => ra[i] + (rb[i] - ra[i]) * amount) as Rgb);
}

/** Whichever of the two candidates contrasts more with `bg`. */
export function bestOn(bg: Hex, candidates: readonly [Hex, Hex]): Hex {
  return contrast(candidates[0], bg) >= contrast(candidates[1], bg) ? candidates[0] : candidates[1];
}

export function isDark(hex: Hex): boolean {
  return luminance(hex) < 0.18;
}

/**
 * Moves `color` toward black or white (whichever increases contrast with
 * `against`) in small steps until the pair reaches `target`. Returns the
 * first passing colour, or null if even black / white can't reach it.
 */
export function nudgeToContrast(color: Hex, against: Hex, target: number): Hex | null {
  if (contrast(color, against) >= target) return color;
  const toward: Hex = isDark(against) ? "#ffffff" : "#000000";
  for (let step = 1; step <= 40; step++) {
    const candidate = mix(color, toward, step / 40);
    if (contrast(candidate, against) >= target) return candidate;
  }
  return null;
}
