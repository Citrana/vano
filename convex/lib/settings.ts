import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Platform settings (CLAUDE.md "Roles & permissions"), shared by the
 * server and the admin settings form. One `platformSettings` document;
 * when it doesn't exist yet the defaults apply: sign-up open, no
 * announcement.
 */

export const ANNOUNCEMENT_MAX = 280;

export type Announcement = { en: string; fr: string };
export type PlatformSettings = { signupEnabled: boolean; announcement: Announcement | null };

export const DEFAULT_SETTINGS: PlatformSettings = { signupEnabled: true, announcement: null };

/**
 * Both empty = no announcement. Otherwise both languages are required so
 * every seller can read it in theirs.
 */
export function announcementProblem({ en, fr }: Announcement): "both_required" | "too_long" | null {
  const a = en.trim();
  const b = fr.trim();
  if (a === "" && b === "") return null;
  if (a === "" || b === "") return "both_required";
  if (a.length > ANNOUNCEMENT_MAX || b.length > ANNOUNCEMENT_MAX) return "too_long";
  return null;
}

export async function settingsDoc(ctx: QueryCtx | MutationCtx) {
  return await ctx.db.query("platformSettings").first();
}

export async function readSettings(ctx: QueryCtx | MutationCtx): Promise<PlatformSettings> {
  const doc = await settingsDoc(ctx);
  if (!doc) return DEFAULT_SETTINGS;
  return { signupEnabled: doc.signupEnabled, announcement: doc.announcement ?? null };
}
