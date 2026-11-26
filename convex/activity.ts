import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { hasFeature } from "./lib/entitlements";
import { requireOwnShop, sellerQuery } from "./lib/seller";
import { memberLabel } from "./lib/team";

/**
 * The shop's activity history (CLAUDE.md "Team accounts"): who did what,
 * newest first. Logged on every plan by `logShopActivity`; reading it is
 * Business only (`teamRoles`): without it the page is locked, nothing is
 * deleted. Owner and Managers (`ownActivity.view`).
 */
export const list = sellerQuery({
  permission: "ownActivity.view",
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const shop = await requireOwnShop(ctx);
    if (!(await hasFeature(ctx, shop, "teamRoles"))) {
      return { locked: true as const, page: [], isDone: true, continueCursor: "" };
    }
    const result = await ctx.db
      .query("shopActivity")
      .withIndex("by_shopId_and_at", (q) => q.eq("shopId", shop._id))
      .order("desc")
      .paginate(paginationOpts);
    const labels = new Map<string, { label: string; isYou: boolean; isOwner: boolean }>();
    const page = [];
    for (const row of result.page) {
      let actor = labels.get(row.actorId);
      if (!actor) {
        actor = {
          label: memberLabel(await ctx.db.get("users", row.actorId)),
          isYou: row.actorId === ctx.user._id,
          isOwner: row.actorId === shop.ownerId,
        };
        labels.set(row.actorId, actor);
      }
      page.push({
        _id: row._id,
        at: row.at,
        kind: row.kind,
        targetId: row.targetId ?? null,
        targetLabel: row.targetLabel,
        details: row.details ?? null,
        actor,
      });
    }
    return { ...result, locked: false as const, page };
  },
});
