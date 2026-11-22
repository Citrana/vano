/**
 * Colour dots on product cards (CLAUDE.md "Shop looks"). Sellers type
 * colours as words ("Red", "noir"); common EN / FR names get a swatch, any
 * other name stays a small text chip. Pure; the only place these swatch
 * values live (never in a component).
 */
const SWATCHES: Record<string, string> = {
  black: "#1a1a1a",
  noir: "#1a1a1a",
  white: "#ffffff",
  blanc: "#ffffff",
  blanche: "#ffffff",
  red: "#c62828",
  rouge: "#c62828",
  blue: "#1e63c4",
  bleu: "#1e63c4",
  navy: "#1f2a52",
  marine: "#1f2a52",
  "bleu marine": "#1f2a52",
  green: "#2e7d4f",
  vert: "#2e7d4f",
  verte: "#2e7d4f",
  yellow: "#f2c230",
  jaune: "#f2c230",
  orange: "#ef7d22",
  pink: "#f19bb5",
  rose: "#f19bb5",
  purple: "#7b3fa0",
  violet: "#7b3fa0",
  brown: "#7a4b2a",
  marron: "#7a4b2a",
  beige: "#d9c4a3",
  grey: "#8a8a8a",
  gray: "#8a8a8a",
  gris: "#8a8a8a",
  grise: "#8a8a8a",
  gold: "#c9a227",
  "doré": "#c9a227",
  "dorée": "#c9a227",
  or: "#c9a227",
  silver: "#c0c0c0",
  argent: "#c0c0c0",
  "argenté": "#c0c0c0",
  cream: "#f3ead8",
  "crème": "#f3ead8",
};

/** The swatch for a colour name (case and spaces ignored), or null for any other name. */
export function colorSwatch(name: string): string | null {
  return SWATCHES[name.trim().toLowerCase().replace(/\s+/g, " ")] ?? null;
}
