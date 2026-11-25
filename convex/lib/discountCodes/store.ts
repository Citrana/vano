import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { getEntitlements, hasFeature, shopProducts, visibleProductIds } from "../entitlements";
import { codeLiveAt } from "./active";
import { CODES_MAX } from "./rules";

/**
 * Database side of discount codes (CLAUDE.md "Discount codes"): reading a
 * shop's codes, the stored `live` flag and its scheduled jobs, clean-up.
 * Callers check permission / ownership.
 */

export async function shopCodes(ctx: QueryCtx, shopId: Id<"shops">): Promise<Doc<"discountCodes">[]> {
  return await ctx.db
    .query("discountCodes")
    .withIndex("by_shopId", (q) => q.eq("shopId", shopId))
    .order("desc")
    .take(CODES_MAX);
}

/** A shop's code by its (normalised) text, or null. */
export async function codeByText(
  ctx: QueryCtx,
  shopId: Id<"shops">,
  code: string,
): Promise<Doc<"discountCodes"> | null> {
  return await ctx.db
    .query("discountCodes")
    .withIndex("by_shopId_and_code", (q) => q.eq("shopId", shopId).eq("code", code))
    .unique();
}

/**
 * The codes visitors can use right now: live ones, and only while the
 * plan includes `discountCodes` (after a downgrade they stop working and
 * the field disappears; the codes stay saved).
 */
export async function liveCodesFor(ctx: QueryCtx, shop: Doc<"shops">): Promise<Doc<"discountCodes">[]> {
  const live = await ctx.db
    .query("discountCodes")
    .withIndex("by_shopId_and_live", (q) => q.eq("shopId", shop._id).eq("live", true))
    .take(CODES_MAX);
  if (live.length === 0) return [];
  return (await hasFeature(ctx, shop, "discountCodes")) ? live : [];
}

/**
 * Whether a visitor can see this product right now (not hidden, inside
 * the plan's product limit, shop not suspended), with its shop.
 */
export async function visibleProduct(
  ctx: QueryCtx,
  productId: string,
): Promise<{ shop: Doc<"shops">; product: Doc<"products"> } | null> {
  const id = ctx.db.normalizeId("products", productId);
  const product = id ? await ctx.db.get("products", id) : null;
  if (!product || product.hidden) return null;
  const shop = await ctx.db.get("shops", product.shopId);
  if (!shop || shop.status === "suspended") return null;
  const { limits } = await getEntitlements(ctx, shop);
  if (!visibleProductIds(await shopProducts(ctx, shop._id), limits).has(product._id)) return null;
  return { shop, product };
}

/**
 * Stores the `live` flag for `now` and schedules `discountCodeJobs.sync`
 * at the code's future start and end. A job left over from an older
 * version recomputes from the current row, so it's harmless.
 */
export async function writeCodeLiveAndSchedule(
  ctx: MutationCtx,
  code: Doc<"discountCodes">,
  now: number,
): Promise<void> {
  const live = codeLiveAt(code, now);
  if (live !== code.live) await ctx.db.patch("discountCodes", code._id, { live });
  for (const at of [code.startsAt, code.endsAt]) {
    if (at <= now) continue;
    await ctx.scheduler.runAt(at, internal.discountCodeJobs.sync, { codeId: code._id });
  }
}

/** Deletes a code now; its use rows are deleted in batches by a job. */
export async function deleteCode(ctx: MutationCtx, code: Doc<"discountCodes">): Promise<void> {
  await ctx.db.delete("discountCodes", code._id);
  await ctx.scheduler.runAfter(0, internal.discountCodeJobs.purgeUses, { codeId: code._id });
}

/**
 * A product is being deleted: drop it from its shop's codes (chosen
 * products and exclusions). Called by `deleteProduct`.
 */
export async function forgetProductInCodes(ctx: MutationCtx, product: Doc<"products">): Promise<void> {
  for (const code of await shopCodes(ctx, product.shopId)) {
    const t = code.target;
    const ids = t.kind === "products" ? t.productIds : t.excludedIds;
    if (!ids.includes(product._id)) continue;
    const next = ids.filter((id) => id !== product._id);
    const target = t.kind === "products" ? { ...t, productIds: next } : { ...t, excludedIds: next };
    await ctx.db.patch("discountCodes", code._id, { target, version: code.version + 1 });
  }
}
