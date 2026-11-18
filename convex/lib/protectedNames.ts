import { slugify } from "./slug";

/**
 * Names a shop must not use without an admin looking first: well-known
 * brands, payment services and our own. A change request whose new name
 * or link contains one is flagged for the admin (never silently
 * accepted, never silently refused). Add entries in lowercase; spaces
 * and dashes are ignored when matching.
 */
export const BRAND_NAMES: readonly string[] = [
  // Us and the channels we rely on.
  "vano",
  "whatsapp",
  "facebook",
  "instagram",
  "tiktok",
  "meta",
  "google",
  // Payments and banks (common in scam shops).
  "mpesa",
  "safaricom",
  "airtel",
  "orange money",
  "vodacom",
  "equity bank",
  "rawbank",
  "paypal",
  "visa",
  "mastercard",
  // Fashion brands.
  "nike",
  "adidas",
  "puma",
  "gucci",
  "louis vuitton",
  "chanel",
  "dior",
  "prada",
  "hermes",
  "versace",
  "balenciaga",
  "zara",
  "shein",
  "uniqlo",
  "jordan",
  "yeezy",
  "lacoste",
  "ralph lauren",
  "tommy hilfiger",
  "calvin klein",
  "victoria's secret",
  "converse",
  "vans",
  "new balance",
  "reebok",
  "fendi",
  "burberry",
  "rolex",
];

/** Lowercase letters and digits only: "Louis-Vuitton!" → "louisvuitton". */
function squash(value: string): string {
  return slugify(value.replace(/&/g, "and")).replace(/-/g, "");
}

const SQUASHED = BRAND_NAMES.map((brand) => ({ brand, key: squash(brand) })).filter(
  ({ key }) => key.length > 0,
);

/** The first brand a name or link contains, or null. */
export function riskyValueMatch(value: string): string | null {
  const squashed = squash(value);
  if (!squashed) return null;
  // Short names ("vans", "visa", "meta", "nike") only match whole words,
  // so "metallic" or "canvas" don't raise false alarms.
  const words = new Set(slugify(value.replace(/&/g, "and")).split("-"));
  for (const { brand, key } of SQUASHED) {
    if (key.length <= 4 ? words.has(key) : squashed.includes(key)) return brand;
  }
  return null;
}
