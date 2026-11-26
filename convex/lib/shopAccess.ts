import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { Access } from "./access";
import { getEntitlements, usableMemberIds } from "./entitlements";
import { isSellerArea, areaOf, type Permission } from "./permissions";
import {
  MAX_MEMBERS_READ,
  MAX_MEMBERSHIPS_READ,
  shopRolePermissions,
  type MemberState,
  type TeamRole,
} from "./team";

/**
 * Which shop a seller screen is about, and what the caller may do there
 * (CLAUDE.md "Team accounts"). "The caller's shop" is their CURRENT shop:
 * the one picked in the switcher (`users.activeShopId`) while they can
 * still use it, else the shop they own, else their oldest usable
 * membership. Permissions are shop-scoped: the global role's admin
 * permissions, plus its seller permissions intersected with the role in
 * that shop (the owner keeps every one).
 */

export type ShopAccess = {
  shop: Doc<"shops">;
  isOwner: boolean;
  /** Null for the owner. */
  member: Doc<"shopMembers"> | null;
  role: TeamRole | "owner";
  /** The effective permissions in this shop (admin ones included). */
  permissions: ReadonlySet<Permission>;
};

export async function findShopByOwner(
  ctx: QueryCtx,
  ownerId: Id<"users">,
): Promise<Doc<"shops"> | null> {
  return await ctx.db
    .query("shops")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
    .unique();
}

export async function membersOf(ctx: QueryCtx, shopId: Id<"shops">): Promise<Doc<"shopMembers">[]> {
  return await ctx.db
    .query("shopMembers")
    .withIndex("by_shopId", (q) => q.eq("shopId", shopId))
    .take(MAX_MEMBERS_READ);
}

export async function findMember(
  ctx: QueryCtx,
  shopId: Id<"shops">,
  userId: Id<"users">,
): Promise<Doc<"shopMembers"> | null> {
  return await ctx.db
    .query("shopMembers")
    .withIndex("by_shopId_and_userId", (q) => q.eq("shopId", shopId).eq("userId", userId))
    .unique();
}

/**
 * Every member's state in a shop: `suspended` (by the owner), `paused`
 * (the plan doesn't allow them now) or `active`. Mutations pass `now`
 * (see `getEntitlements`).
 */
export async function memberStates(
  ctx: QueryCtx,
  shop: Doc<"shops">,
  members: readonly Doc<"shopMembers">[],
  now?: number,
): Promise<Map<Id<"shopMembers">, MemberState>> {
  const { limits } = await getEntitlements(ctx, shop, now);
  const usable = usableMemberIds(members, limits);
  return new Map(
    members.map((m) => [m._id, m.status === "suspended" ? "suspended" : usable.has(m._id) ? "active" : "paused"]),
  );
}

export async function memberState(
  ctx: QueryCtx,
  shop: Doc<"shops">,
  member: Doc<"shopMembers">,
  now?: number,
): Promise<MemberState> {
  if (member.status === "suspended") return "suspended";
  const states = await memberStates(ctx, shop, await membersOf(ctx, shop._id), now);
  return states.get(member._id) ?? "paused";
}

/** Global admin permissions + global seller permissions ∩ the shop role. */
export function effectivePermissions(global: ReadonlySet<Permission>, role: TeamRole | "owner"): Set<Permission> {
  const allowed = new Set(shopRolePermissions(role));
  return new Set([...global].filter((p) => !isSellerArea(areaOf(p)) || allowed.has(p)));
}

/** The caller's access to one shop, or null when they neither own it nor can use it as a member. */
export async function shopAccessFor(
  ctx: QueryCtx,
  access: Access,
  shop: Doc<"shops">,
  now?: number,
): Promise<ShopAccess | null> {
  if (shop.ownerId === access.user._id) {
    return { shop, isOwner: true, member: null, role: "owner", permissions: effectivePermissions(access.permissions, "owner") };
  }
  const member = await findMember(ctx, shop._id, access.user._id);
  if (!member || (await memberState(ctx, shop, member, now)) !== "active") return null;
  return {
    shop,
    isOwner: false,
    member,
    role: member.role,
    permissions: effectivePermissions(access.permissions, member.role),
  };
}

/** The caller's memberships (oldest first), bounded. */
export async function membershipsOf(ctx: QueryCtx, userId: Id<"users">): Promise<Doc<"shopMembers">[]> {
  const rows = await ctx.db
    .query("shopMembers")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(MAX_MEMBERSHIPS_READ);
  return rows.sort((a, b) => a.joinedAt - b.joinedAt);
}

/** The caller's current shop and what they may do there; null when they have none. */
export async function currentShopAccess(
  ctx: QueryCtx,
  access: Access,
  now?: number,
): Promise<ShopAccess | null> {
  const picked = access.user.activeShopId ? await ctx.db.get("shops", access.user.activeShopId) : null;
  if (picked) {
    const result = await shopAccessFor(ctx, access, picked, now);
    if (result) return result;
  }
  const own = await findShopByOwner(ctx, access.user._id);
  if (own) return await shopAccessFor(ctx, access, own, now);
  for (const member of await membershipsOf(ctx, access.user._id)) {
    if (member.shopId === picked?._id) continue;
    const shop = await ctx.db.get("shops", member.shopId);
    if (!shop) continue;
    const result = await shopAccessFor(ctx, access, shop, now);
    if (result) return result;
  }
  return null;
}

export type MyShop = {
  shop: Doc<"shops">;
  role: TeamRole | "owner";
  state: MemberState;
};

/** Every shop the user owns or belongs to, owner's shop first (switcher, paused screen). */
export async function myShops(ctx: QueryCtx, userId: Id<"users">): Promise<MyShop[]> {
  const out: MyShop[] = [];
  const own = await findShopByOwner(ctx, userId);
  if (own) out.push({ shop: own, role: "owner", state: "active" });
  for (const member of await membershipsOf(ctx, userId)) {
    const shop = await ctx.db.get("shops", member.shopId);
    if (!shop) continue;
    out.push({ shop, role: member.role, state: await memberState(ctx, shop, member) });
  }
  return out;
}

/** True when the user owns the shop or has a member row in it (any state). */
export async function belongsToShop(ctx: QueryCtx, userId: Id<"users">, shop: Doc<"shops">): Promise<boolean> {
  if (shop.ownerId === userId) return true;
  return (await findMember(ctx, shop._id, userId)) !== null;
}
