import { v, type Infer } from "convex/values";

/**
 * The Promo bar (CLAUDE.md "Shop looks"): one slim line under the shop
 * header. It decides its own text (`promoBarContent`): a running sale
 * (title, discount, countdown, "View sale"), else the seller's text, else
 * nothing. Stored as the optional `announcement` facet of the look (the
 * old announcement bar: every field added since is optional, so stored
 * looks keep working), with optional dates that follow the event banner
 * rules (schedule.ts). Publishing it needs the `announcementBar` plan
 * feature; the page uses it only while live (`shopLooks.announcementLive`)
 * and entitled.
 *
 * Colours: a shop colour `tone` ("Match my shop colours"), or custom
 * background + text colours picked by the seller (the one place a text
 * colour is picked), always checked by `lookProblems` (4.5:1, publish
 * refuses less).
 */

export const ANNOUNCEMENT_TEXT_MAX = 80;
export const ANNOUNCEMENT_URL_MAX = 300;

/** accent: the accent colour; dark: the page's text colour as the fill; soft: a tint of the badge colour. */
export const ANNOUNCEMENT_TONES = ["accent", "dark", "soft"] as const;
export const announcementToneValidator = v.union(v.literal("accent"), v.literal("dark"), v.literal("soft"));
export type AnnouncementTone = Infer<typeof announcementToneValidator>;

export const announcementLinkValidator = v.union(
  v.object({ kind: v.literal("sale") }),
  v.object({ kind: v.literal("url"), url: v.string() }),
);
export type AnnouncementLink = Infer<typeof announcementLinkValidator>;

/** solid: a flat fill; gradient: the fill fading toward a lighter / darker shade; outline: a border on the page. */
export const PROMO_STYLES = ["solid", "gradient", "outline"] as const;
export const promoStyleValidator = v.union(v.literal("solid"), v.literal("gradient"), v.literal("outline"));
export type PromoStyle = Infer<typeof promoStyleValidator>;

export const PROMO_ICONS = ["tag", "sparkle", "flower", "none"] as const;
export const promoIconValidator = v.union(v.literal("tag"), v.literal("sparkle"), v.literal("flower"), v.literal("none"));
export type PromoIcon = Infer<typeof promoIconValidator>;

/** Custom colours ("#rrggbb"); the pair is checked like every shop colour. */
export const promoColorsValidator = v.object({ background: v.string(), foreground: v.string() });
export type PromoColors = Infer<typeof promoColorsValidator>;

export const PROMO_TITLE_MAX = 40;

export const announcementFacetValidator = v.object({
  /** 0 – ANNOUNCEMENT_TEXT_MAX chars, one line; shown when no sale runs. Empty = sale-only bar. */
  text: v.string(),
  /** "sale": the shop's sale items (only while a sale runs); "url": an https link. */
  link: v.optional(announcementLinkValidator),
  tone: announcementToneValidator,
  startsAt: v.optional(v.number()),
  endsAt: v.optional(v.number()),
  /** Missing = "solid". */
  style: v.optional(promoStyleValidator),
  /** Missing = the `tone` (shop colours). */
  colors: v.optional(promoColorsValidator),
  /** Missing = "none" (bars saved before the Promo bar look the same). */
  icon: v.optional(promoIconValidator),
  /** Replaces the sale headline ("Up to 30% off"), 1 – PROMO_TITLE_MAX chars. */
  title: v.optional(v.string()),
  /** Missing = true: the sale countdown shows (when the sale itself shows one). */
  countdown: v.optional(v.boolean()),
  /** Missing = true: visitors can close the bar for their visit. */
  closable: v.optional(v.boolean()),
});
export type AnnouncementFacet = Infer<typeof announcementFacetValidator>;

/** What a running sale tells the bar (computed by the page from its products). */
export type PromoSaleSummary = {
  /** The biggest discount on sale, in percent. */
  percent: number;
  /** Every product on sale has the same discount ("30% off" instead of "Up to 30% off"). */
  uniform: boolean;
  /** The soonest end among sales that show a countdown, else null. */
  endsAt: number | null;
};

/** The sale summary for a list of products (null = nothing on sale). */
export function promoSaleSummary(
  products: readonly { sale?: { percent: number; endsAt: number; countdown: boolean } | null }[],
): PromoSaleSummary | null {
  const sales = products.flatMap((p) => (p.sale ? [p.sale] : []));
  if (sales.length === 0) return null;
  const percent = Math.max(...sales.map((s) => s.percent));
  const ends = sales.filter((s) => s.countdown).map((s) => s.endsAt);
  return { percent, uniform: sales.every((s) => s.percent === percent), endsAt: ends.length > 0 ? Math.min(...ends) : null };
}

export type PromoBarContent =
  | { kind: "sale"; title: string | null; percent: number; uniform: boolean; endsAt: number | null }
  | { kind: "announcement"; text: string; link: AnnouncementLink | null };

/**
 * What the Promo bar says: a running sale wins (the seller's title, else
 * the discount; the countdown unless the bar turns it off), then the
 * seller's text, else nothing (the bar is hidden).
 */
export function promoBarContent(
  bar: { text: string; link: AnnouncementLink | null; title: string | null; countdown: boolean } | null,
  sale: PromoSaleSummary | null,
): PromoBarContent | null {
  if (sale) {
    return {
      kind: "sale",
      title: bar?.title ?? null,
      percent: sale.percent,
      uniform: sale.uniform,
      endsAt: bar && !bar.countdown ? null : sale.endsAt,
    };
  }
  if (bar && bar.text.length > 0) return { kind: "announcement", text: bar.text, link: bar.link };
  return null;
}

/**
 * An https link, normalised (a missing scheme gets "https://"), or null
 * when it isn't one. Only http(s) to a host with a dot, no credentials.
 */
export function cleanAnnouncementUrl(raw: string): string | null {
  const value = raw.trim();
  if (value.length === 0 || value.length > ANNOUNCEMENT_URL_MAX) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || !url.hostname.includes(".")) return null;
  url.protocol = "https:";
  return url.toString();
}
