import { v } from "convex/values";
import { query } from "./_generated/server";
import { getCurrentUserOrNull } from "./lib/auth";
import { findShopByOwner } from "./lib/seller";

/**
 * Who is signed in and whether they have a shop yet. Drives the seller
 * redirects: no user → /login, no shop → /onboarding, else /dashboard.
 */
export const viewer = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      email: v.union(v.string(), v.null()),
      hasShop: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) return null;
    const shop = await findShopByOwner(ctx, user._id);
    return { email: user.email ?? null, hasShop: shop !== null };
  },
});
