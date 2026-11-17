import { v } from "convex/values";
import { adminMutation, adminQuery } from "../lib/access";
import { logAdminAction } from "../lib/audit";
import { fail } from "../lib/errors";
import { announcementProblem, readSettings, settingsDoc } from "../lib/settings";

/**
 * Admin settings (CLAUDE.md "Roles & permissions"): public sign-up on/off
 * and the seller announcement (English + French).
 */

const settingsFields = {
  signupEnabled: v.boolean(),
  announcementEn: v.string(),
  announcementFr: v.string(),
};

export const get = adminQuery({
  permission: "settings.view",
  args: {},
  returns: v.object(settingsFields),
  handler: async (ctx) => {
    const settings = await readSettings(ctx);
    return {
      signupEnabled: settings.signupEnabled,
      announcementEn: settings.announcement?.en ?? "",
      announcementFr: settings.announcement?.fr ?? "",
    };
  },
});

/** Saves the settings (logged). No-op if nothing changes. */
export const update = adminMutation({
  permission: "settings.manage",
  args: settingsFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    const en = args.announcementEn.trim();
    const fr = args.announcementFr.trim();
    if (announcementProblem({ en, fr }) !== null) fail("ANNOUNCEMENT_INVALID");
    const announcement = en === "" ? undefined : { en, fr };

    const before = await readSettings(ctx);
    const announcementChange = !before.announcement
      ? announcement
        ? "set"
        : "unchanged"
      : !announcement
        ? "cleared"
        : before.announcement.en === en && before.announcement.fr === fr
          ? "unchanged"
          : "changed";
    if (before.signupEnabled === args.signupEnabled && announcementChange === "unchanged") return null;

    const doc = await settingsDoc(ctx);
    const next = { signupEnabled: args.signupEnabled, announcement };
    if (doc) await ctx.db.replace("platformSettings", doc._id, next);
    else await ctx.db.insert("platformSettings", next);

    await logAdminAction(ctx, {
      actor: ctx.user,
      action: "settings.update",
      targetType: "settings",
      targetId: "platform",
      targetLabel: "Platform settings",
      details: { signupEnabled: args.signupEnabled, announcement: announcementChange },
    });
    return null;
  },
});
