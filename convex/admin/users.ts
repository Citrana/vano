import { paginationOptsValidator, paginationResultValidator, type PaginationResult } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { adminQuery } from "../lib/access";
import { roleKeyValidator, userStatusValidator } from "../lib/permissions";
import { findShopByOwner } from "../lib/seller";

/**
 * Admin users section (CLAUDE.md "Roles & permissions"). Reads need
 * `users.view`; writes (setStatus / assignRole) live below with their own
 * permissions and the safety rules from `convex/lib/guards.ts`.
 */

const roleOption = v.object({ _id: v.id("roles"), key: v.union(roleKeyValidator, v.null()), name: v.string() });

async function rolesById(ctx: QueryCtx): Promise<Map<Id<"roles">, Doc<"roles">>> {
  const roles = await ctx.db.query("roles").take(200);
  return new Map(roles.map((r) => [r._id, r]));
}

/** Every role, for the role filter and the role picker. */
export const roleOptions = adminQuery({
  permission: "users.view",
  args: {},
  returns: v.array(roleOption),
  handler: async (ctx) => {
    const roles = await ctx.db.query("roles").take(200);
    return roles.map((r) => ({ _id: r._id, key: r.key ?? null, name: r.name }));
  },
});

const userRow = v.object({
  _id: v.id("users"),
  email: v.string(),
  roleKey: v.union(roleKeyValidator, v.null()),
  roleName: v.string(),
  status: userStatusValidator,
  createdAt: v.number(),
  shopName: v.union(v.string(), v.null()),
});

function pageOfUsers(
  ctx: QueryCtx,
  args: {
    paginationOpts: { numItems: number; cursor: string | null };
    search?: string;
    roleId?: Id<"roles">;
    status?: "active" | "suspended";
  },
): Promise<PaginationResult<Doc<"users">>> {
  const { paginationOpts, roleId, status } = args;
  const search = args.search?.trim();
  if (search) {
    return ctx.db
      .query("users")
      .withSearchIndex("search_email", (q) => {
        const base = q.search("email", search);
        if (roleId && status) return base.eq("roleId", roleId).eq("status", status);
        if (roleId) return base.eq("roleId", roleId);
        if (status) return base.eq("status", status);
        return base;
      })
      .paginate(paginationOpts);
  }
  if (roleId) {
    return ctx.db
      .query("users")
      .withIndex("by_roleId_and_status", (q) =>
        status ? q.eq("roleId", roleId).eq("status", status) : q.eq("roleId", roleId),
      )
      .order("desc")
      .paginate(paginationOpts);
  }
  if (status) {
    return ctx.db
      .query("users")
      .withIndex("by_status", (q) => q.eq("status", status))
      .order("desc")
      .paginate(paginationOpts);
  }
  return ctx.db.query("users").order("desc").paginate(paginationOpts);
}

/**
 * Users, newest first (or by relevance when searching the email). Users
 * not migrated yet (no status) only appear under "all statuses".
 */
export const list = adminQuery({
  permission: "users.view",
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    roleId: v.optional(v.id("roles")),
    status: v.optional(userStatusValidator),
  },
  returns: paginationResultValidator(userRow),
  handler: async (ctx, args) => {
    const roles = await rolesById(ctx);
    const result = await pageOfUsers(ctx, args);
    const page = await Promise.all(
      result.page.map(async (user) => {
        const role = user.roleId ? roles.get(user.roleId) : undefined;
        const shop = await findShopByOwner(ctx, user._id);
        return {
          _id: user._id,
          email: user.email ?? "",
          // Not migrated yet (no role) = seller, like `accessOf`.
          roleKey: role ? (role.key ?? null) : ("seller" as const),
          roleName: role?.name ?? "Seller",
          status: user.status ?? ("active" as const),
          createdAt: user._creationTime,
          shopName: shop?.name ?? null,
        };
      }),
    );
    return { ...result, page };
  },
});

/**
 * One user for the details page, or null for an unknown / mistyped id.
 * `isSelf` / `isSuperAdmin` only hide buttons; the mutations enforce the
 * rules themselves.
 */
export const get = adminQuery({
  permission: "users.view",
  args: { userId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      email: v.string(),
      status: userStatusValidator,
      createdAt: v.number(),
      role: v.union(roleOption, v.null()),
      shop: v.union(
        v.null(),
        v.object({
          _id: v.id("shops"),
          name: v.string(),
          slug: v.string(),
          status: v.union(v.literal("active"), v.literal("suspended")),
        }),
      ),
      isSelf: v.boolean(),
      isSuperAdmin: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = ctx.db.normalizeId("users", args.userId);
    const user = userId ? await ctx.db.get("users", userId) : null;
    if (!user) return null;
    const role = user.roleId ? await ctx.db.get("roles", user.roleId) : null;
    const shop = await findShopByOwner(ctx, user._id);
    return {
      _id: user._id,
      email: user.email ?? "",
      status: user.status ?? "active",
      createdAt: user._creationTime,
      role: role ? { _id: role._id, key: role.key ?? null, name: role.name } : null,
      shop: shop
        ? { _id: shop._id, name: shop.name, slug: shop.slug, status: shop.status ?? "active" }
        : null,
      isSelf: user._id === ctx.user._id,
      isSuperAdmin: role?.key === "super_admin",
    };
  },
});
