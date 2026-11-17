import { v } from "convex/values";
import { query } from "./_generated/server";
import { getCurrentUserOrNull } from "./lib/auth";
import { findShopByOwner } from "./lib/seller";

const statusValidator = v.union(v.literal("active"), v.literal("suspended"));

/**
 * Who is signed in, whether they have a shop yet, and whether the account
 * or shop is suspended. Drives the seller redirects (no user → /login, no
 * shop → /onboarding, else /dashboard) and the suspended screen / banner.
 *
 * Never throws for a suspended user (unlike every other function), so the
 * UI can always learn why it's being refused. A missing status (not
 * migrated yet) counts as active.
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
    }),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) return null;
    const shop = await findShopByOwner(ctx, user._id);
    return {
      email: user.email ?? null,
      hasShop: shop !== null,
      status: user.status ?? "active",
      shopStatus: shop === null ? null : (shop.status ?? "active"),
    };
  },
});
