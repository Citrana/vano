import { v, type Infer } from "convex/values";

/**
 * The announcement bar (CLAUDE.md "Shop looks"): one short line at the top
 * of the shop, e.g. "Free delivery in Nairobi this weekend". An optional
 * `announcement` facet of the look, with optional dates that follow the
 * event banner rules (schedule.ts). Publishing it needs the
 * `announcementBar` plan feature; the page shows it only while live
 * (`shopLooks.announcementLive`) and entitled.
 *
 * Colours are shop colours only (`AnnouncementTone`); text colours are
 * derived (resolve.ts) and checked by `lookProblems`.
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

export const announcementFacetValidator = v.object({
  /** 1 – ANNOUNCEMENT_TEXT_MAX chars, one line. */
  text: v.string(),
  /** "sale": the shop's sale items (only while a sale runs); "url": an https link. */
  link: v.optional(announcementLinkValidator),
  tone: announcementToneValidator,
  startsAt: v.optional(v.number()),
  endsAt: v.optional(v.number()),
});
export type AnnouncementFacet = Infer<typeof announcementFacetValidator>;

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
