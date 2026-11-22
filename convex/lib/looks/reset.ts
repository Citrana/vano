import { FREE_LOOK } from "./presets";
import type { StoredLook } from "./validators";

/**
 * Admin look reset (CLAUDE.md "Shop looks"): "banner" removes the banner
 * photo, any banner text, the event & promo banner and the announcement
 * bar (colours and buttons stay); "profile" puts the profile photo options
 * and decoration back to the default; "all" goes back to the free look
 * (default sections and layout, no announcement bar). Pure;
 * `admin/shopLooks.reset` applies it to both the published look and the draft.
 */
export type ResetScope = "banner" | "profile" | "all";
export const RESET_SCOPES: readonly ResetScope[] = ["banner", "profile", "all"];

export const RESET_REASON_MIN = 5;
export const RESET_REASON_MAX = 300;

export function resetReasonProblem(reason: string): "length" | null {
  const length = reason.trim().length;
  return length < RESET_REASON_MIN || length > RESET_REASON_MAX ? "length" : null;
}

export function resetLook(look: StoredLook, scope: ResetScope): StoredLook {
  if (scope === "all") return FREE_LOOK;
  const overrides = { ...look.overrides };
  if (scope === "profile") {
    delete overrides.profile;
    return { ...look, overrides };
  }
  delete overrides.promo;
  delete overrides.announcement;
  const banner = overrides.banner;
  if (banner && banner.kind !== "none") {
    overrides.banner = banner.kind === "photo" ? { kind: "none" } : { ...banner, text: undefined };
  }
  return { ...look, overrides };
}

/** The profile decoration a look uses (admin view, audit log), or null. */
export function decorationOf(look: StoredLook | null | undefined): string | null {
  return look?.overrides.profile?.decoration?.id ?? null;
}

/** The event & promo banner's headline (admin view, audit log), or null. */
export function promoHeadlineOf(look: StoredLook | null | undefined): string | null {
  return look?.overrides.promo?.design.headline ?? null;
}

/** The announcement bar's text (admin view, audit log), or null. */
export function announcementTextOf(look: StoredLook | null | undefined): string | null {
  return look?.overrides.announcement?.text ?? null;
}

/** The banner text a look shows (for the admin view and the audit log), or null. */
export function bannerTextOf(look: StoredLook | null | undefined): string | null {
  const banner = look?.overrides.banner;
  return banner && banner.kind !== "none" ? (banner.text?.value ?? null) : null;
}
