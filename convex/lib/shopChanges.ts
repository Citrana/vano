import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { maskPhone, SLUG_REDIRECT_DAYS, type ProtectedField } from "./changeRequests";
import { fail } from "./errors";
import { DAY_MS } from "./plans";
import { subscriptionDoc } from "./subscriptions";

/** The live value of a protected field. */
export function currentValue(shop: Doc<"shops">, field: ProtectedField): string {
  if (field === "name") return shop.name;
  if (field === "slug") return shop.slug;
  return shop.whatsappNumber;
}

/** The shop's pending request for a field, if any. */
export async function pendingRequest(ctx: QueryCtx, shopId: Id<"shops">, field: ProtectedField) {
  return await ctx.db
    .query("shopChangeRequests")
    .withIndex("by_shopId_and_field_and_status", (q) =>
      q.eq("shopId", shopId).eq("field", field).eq("status", "pending"),
    )
    .first();
}

/** When this field's last approved change was decided, or null. */
export async function lastApprovedAt(
  ctx: QueryCtx,
  shopId: Id<"shops">,
  field: ProtectedField,
): Promise<number | null> {
  const approved = await ctx.db
    .query("shopChangeRequests")
    .withIndex("by_shopId_and_field_and_status", (q) =>
      q.eq("shopId", shopId).eq("field", field).eq("status", "approved"),
    )
    .order("desc")
    .first();
  return approved?.decidedAt ?? null;
}

/** For the activity log: phone numbers are masked. */
export function loggedValue(field: ProtectedField, value: string): string {
  return field === "whatsapp" ? maskPhone(value) : value;
}

/**
 * Who holds a shop link right now: a shop using it, or a shop whose old
 * link it was (redirecting and reserved until the redirect expires).
 * One rule for onboarding, the live slug check and approvals.
 */
export async function slugHolder(ctx: QueryCtx, slug: string): Promise<Id<"shops"> | null> {
  const shop = await ctx.db
    .query("shops")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (shop) return shop._id;
  const redirect = await ctx.db
    .query("slugRedirects")
    .withIndex("by_fromSlug", (q) => q.eq("fromSlug", slug))
    .unique();
  return redirect?.shopId ?? null;
}

/** True if `shopId` (or anyone, when null) may take `slug`. */
export async function slugAvailableFor(
  ctx: QueryCtx,
  slug: string,
  shopId: Id<"shops"> | null,
): Promise<boolean> {
  const holder = await slugHolder(ctx, slug);
  return holder === null || holder === shopId;
}

/** Keeps the shop-name copy used by the admin subscription search in sync. */
export async function syncShopName(ctx: MutationCtx, shopId: Id<"shops">, name: string): Promise<void> {
  const subscription = await subscriptionDoc(ctx, shopId);
  if (subscription && subscription.shopName !== name) {
    await ctx.db.patch("subscriptions", subscription._id, { shopName: name });
  }
}

/**
 * The only writer of a protected field after the shop is created (an
 * approved change request). Runs inside the approval's transaction: two
 * approvals racing for one link conflict, and the retry sees the link
 * taken and fails with SLUG_TAKEN.
 */
export async function applyShopChange(
  ctx: MutationCtx,
  shop: Doc<"shops">,
  field: ProtectedField,
  value: string,
  now: number,
): Promise<void> {
  if (field === "name") {
    await ctx.db.patch("shops", shop._id, { name: value });
    await syncShopName(ctx, shop._id, value);
    return;
  }
  if (field === "whatsapp") {
    await ctx.db.patch("shops", shop._id, { whatsappNumber: value });
    return;
  }

  if (!(await slugAvailableFor(ctx, value, shop._id))) fail("SLUG_TAKEN");
  // Taking back one of its own old links: that redirect is no longer needed.
  const ownRedirect = await ctx.db
    .query("slugRedirects")
    .withIndex("by_fromSlug", (q) => q.eq("fromSlug", value))
    .unique();
  if (ownRedirect) await ctx.db.delete("slugRedirects", ownRedirect._id);

  await ctx.db.patch("shops", shop._id, { slug: value });
  // The old link keeps working (and stays reserved) for a while.
  await ctx.db.insert("slugRedirects", {
    fromSlug: shop.slug,
    shopId: shop._id,
    expiresAt: now + SLUG_REDIRECT_DAYS * DAY_MS,
  });
}
