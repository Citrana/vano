import { FREE_LOOK } from "./presets";
import type { StoredLook } from "./validators";

/**
 * Admin look reset (CLAUDE.md "Shop looks"): "banner" removes the banner
 * photo and any banner text (colours and buttons stay); "all" goes back
 * to the free look. Pure; `admin/shopLooks.reset` applies it to both the
 * published look and the draft.
 */
export type ResetScope = "banner" | "all";

export const RESET_REASON_MIN = 5;
export const RESET_REASON_MAX = 300;

export function resetReasonProblem(reason: string): "length" | null {
  const length = reason.trim().length;
  return length < RESET_REASON_MIN || length > RESET_REASON_MAX ? "length" : null;
}

export function resetLook(look: StoredLook, scope: ResetScope): StoredLook {
  if (scope === "all") return FREE_LOOK;
  const banner = look.overrides.banner;
  if (!banner || banner.kind === "none") return look;
  const safe = banner.kind === "photo" ? ({ kind: "none" } as const) : { ...banner, text: undefined };
  return { ...look, overrides: { ...look.overrides, banner: safe } };
}

/** The banner text a look shows (for the admin view and the audit log), or null. */
export function bannerTextOf(look: StoredLook | null | undefined): string | null {
  const banner = look?.overrides.banner;
  return banner && banner.kind !== "none" ? (banner.text?.value ?? null) : null;
}
