import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { ActivityDetails, ActivityKind } from "./team";

/**
 * The shop's activity history: who did what (CLAUDE.md "Team accounts").
 * The ONLY writer of `shopActivity`, called in the same mutation as the
 * change, so the history never misses a change or records one that rolled
 * back. Logged on every plan; the page that reads it is Business only.
 */
export async function logShopActivity(
  ctx: MutationCtx,
  shop: Pick<Doc<"shops">, "_id">,
  entry: {
    actor: Pick<Doc<"users">, "_id">;
    kind: ActivityKind;
    targetId?: string;
    /** Snapshot (product, offer or member name) so it survives deletion. */
    targetLabel: string;
    details?: ActivityDetails;
  },
): Promise<Id<"shopActivity">> {
  return await ctx.db.insert("shopActivity", {
    shopId: shop._id,
    actorId: entry.actor._id,
    kind: entry.kind,
    targetId: entry.targetId,
    targetLabel: entry.targetLabel,
    details: entry.details,
    at: Date.now(),
  });
}
