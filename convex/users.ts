import { v } from "convex/values";
import { query } from "./_generated/server";
import { accessOf, isAdmin } from "./lib/access";
import { getCurrentUserOrNull } from "./lib/auth";
import { roleKeyValidator } from "./lib/permissions";
import { findShopByOwner } from "./lib/seller";
import { readSettings } from "./lib/settings";

const statusValidator = v.union(v.literal("active"), v.literal("suspended"));

/**
 * Who is signed in, whether they have a shop yet, and whether the account
 * or shop is suspended. Drives the seller redirects (no user → /login, no
 * shop → /onboarding, else /dashboard) and the suspended screen / banner.
 *
 * Never throws for a suspended user (unlike every other function), so the
 * UI can always learn why it's being refused. A missing status (not
 * migrated yet) counts as active.
 *
 * `permissions` / `isAdmin` only decide what the UI shows: every server
 * function checks permissions again on its own.
 */
export const viewer = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      email: v.union(v.string(), v.null()),
      hasShop: v.boolean(),
      status: statusValidator,
      shopStatus: v.union(statusValidator, v.null()),
      /** Built-in role key, or null for a custom role. */
      roleKey: v.union(roleKeyValidator, v.null()),
      roleName: v.string(),
      permissions: v.array(v.string()),
      isAdmin: v.boolean(),
      /** The platform announcement (admin settings), in both languages. */
      announcement: v.union(v.object({ en: v.string(), fr: v.string() }), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) return null;
    const shop = await findShopByOwner(ctx, user._id);
    const access = await accessOf(ctx, user);
    return {
      email: user.email ?? null,
      hasShop: shop !== null,
      status: user.status ?? "active",
      shopStatus: shop === null ? null : (shop.status ?? "active"),
      // Not migrated yet (no role) = seller, like `accessOf`.
      roleKey: access.role ? (access.role.key ?? null) : "seller",
      roleName: access.role?.name ?? "Seller",
      permissions: [...access.permissions],
      isAdmin: isAdmin(access),
      announcement: (await readSettings(ctx)).announcement,
    };
  },
});
