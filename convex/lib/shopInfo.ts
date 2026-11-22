import { v, type Infer } from "convex/values";

/**
 * The shop's "About and contact" details (CLAUDE.md "Shop looks"), edited
 * in Shop settings and shown on the shop page (only the filled parts) when
 * the look's About switch is on. Pure, shared by `shops.update` and the
 * settings form (CLAUDE.md "Shared validation").
 */

export const SHOP_INFO_LIMITS = {
  openingHoursMax: 120,
  deliveryAreasMax: 160,
} as const;

export const SOCIAL_NETWORKS = ["instagram", "tiktok", "facebook"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export const socialsValidator = v.object({
  instagram: v.optional(v.string()),
  tiktok: v.optional(v.string()),
  facebook: v.optional(v.string()),
});
export type Socials = Infer<typeof socialsValidator>;

const HOSTS: Record<SocialNetwork, readonly string[]> = {
  instagram: ["instagram.com", "www.instagram.com", "m.instagram.com"],
  tiktok: ["tiktok.com", "www.tiktok.com", "m.tiktok.com"],
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.com", "web.facebook.com"],
};

const HANDLE: Record<SocialNetwork, RegExp> = {
  instagram: /^[A-Za-z0-9._]{1,30}$/,
  tiktok: /^[A-Za-z0-9._]{2,24}$/,
  facebook: /^[A-Za-z0-9.-]{3,50}$/,
};

/**
 * One line of free text: whitespace collapsed, control characters dropped.
 * Empty → undefined, too long → null.
 */
export function cleanInfoText(value: string | undefined, max: number): string | undefined | null {
  if (value === undefined) return undefined;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (text.length === 0) return undefined;
  return text.length > max ? null : text;
}

/**
 * A profile handle from what the seller typed: "@name", "name" or a
 * profile link (instagram.com/name, tiktok.com/@name, facebook.com/name).
 * Empty → undefined; not a handle of that network → null.
 */
export function socialHandle(network: SocialNetwork, raw: string | undefined): string | undefined | null {
  if (raw === undefined) return undefined;
  let value = raw.trim();
  if (value.length === 0) return undefined;
  if (value.includes("/")) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    } catch {
      return null;
    }
    if (!HOSTS[network].includes(url.hostname.toLowerCase())) return null;
    value = url.pathname.split("/").filter(Boolean)[0] ?? "";
  }
  value = value.replace(/^@/, "");
  return HANDLE[network].test(value) ? value : null;
}

/** The public profile link for a handle. */
export function socialUrl(network: SocialNetwork, handle: string): string {
  const safe = encodeURIComponent(handle);
  if (network === "instagram") return `https://www.instagram.com/${safe}`;
  if (network === "tiktok") return `https://www.tiktok.com/@${safe}`;
  return `https://www.facebook.com/${safe}`;
}

export type ShopInfoInput = { openingHours?: string; deliveryAreas?: string; socials?: Socials };
export type ShopInfoProblem = "tooLong" | "social";

/** Cleans the About and contact fields; every key present (undefined = cleared). */
export type CleanShopInfo = {
  openingHours: string | undefined;
  deliveryAreas: string | undefined;
  socials: Socials | undefined;
};

export function cleanShopInfo(input: ShopInfoInput): { ok: true; value: CleanShopInfo } | { ok: false; problem: ShopInfoProblem } {
  const openingHours = cleanInfoText(input.openingHours, SHOP_INFO_LIMITS.openingHoursMax);
  const deliveryAreas = cleanInfoText(input.deliveryAreas, SHOP_INFO_LIMITS.deliveryAreasMax);
  if (openingHours === null || deliveryAreas === null) return { ok: false, problem: "tooLong" };
  const socials: Socials = {};
  for (const network of SOCIAL_NETWORKS) {
    const handle = socialHandle(network, input.socials?.[network]);
    if (handle === null) return { ok: false, problem: "social" };
    if (handle !== undefined) socials[network] = handle;
  }
  return {
    ok: true,
    value: { openingHours, deliveryAreas, socials: Object.keys(socials).length > 0 ? socials : undefined },
  };
}
