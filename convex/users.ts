import { v } from "convex/values";
import { query } from "./_generated/server";
import { accessOf, isAdmin } from "./lib/access";
import { getCurrentUserOrNull } from "./lib/auth";
import { urlOf } from "./lib/images";
import { roleKeyValidator } from "./lib/permissions";
import { currentShopAccess, myShops } from "./lib/shopAccess";
import { readSettings } from "./lib/settings";
import { teamRoleValidator } from "./lib/team";

const statusValidator = v.union(v.literal("active"), v.literal("suspended"));
const shopRoleValidator = v.union(v.literal("owner"), teamRoleValidator);

/**
 * Who is signed in, which shop the seller screens show (their CURRENT
 * shop: own shop or a team membership, CLAUDE.md "Team accounts") and
 * whether the account or shop is suspended. Drives the seller redirects
 * (no user → /login, no shop → /onboarding, only paused memberships → the
 * paused screen, else /dashboard) and the suspended screen / banner.
 *
 * Never throws for a suspended user (unlike every other function), so the
 * UI can always learn why it's being refused. A missing status (not
 * migrated yet) counts as active.
 *
 * `permissions` are the effective ones in the current shop (the team role
 * narrows the seller ones). They only decide what the UI shows: every
 * server function checks permissions again on its own.
 */
export const viewer = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      email: v.union(v.string(), v.null()),
      /** Has a current shop (own or a usable membership). */
      hasShop: v.boolean(),
      /** Owns a shop (onboarding creates one only if not). */
      ownsShop: v.boolean(),
      status: statusValidator,
      shopStatus: v.union(statusValidator, v.null()),
      /** Built-in role key, or null for a custom role. */
      roleKey: v.union(roleKeyValidator, v.null()),
      roleName: v.string(),
      permissions: v.array(v.string()),
      isAdmin: v.boolean(),
      /** The current shop and the caller's role in it. */
      shop: v.union(
        v.null(),
        v.object({ id: v.id("shops"), name: v.string(), role: shopRoleValidator }),
      ),
      /** Every shop the caller owns or belongs to (the switcher), with their state there. */
      shops: v.array(
        v.object({
          id: v.id("shops"),
          name: v.string(),
          logoUrl: v.union(v.string(), v.null()),
          role: shopRoleValidator,
          state: v.union(v.literal("active"), v.literal("suspended"), v.literal("paused")),
        }),
      ),
      /** The platform announcement (admin settings), in both languages. */
      announcement: v.union(v.object({ en: v.string(), fr: v.string() }), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) return null;
    const access = await accessOf(ctx, user);
    const current = await currentShopAccess(ctx, access);
    const shops = await myShops(ctx, user._id);
    const permissions = current ? current.permissions : access.permissions;
    return {
      email: user.email ?? null,
      hasShop: current !== null,
      ownsShop: shops.some((s) => s.role === "owner"),
      status: user.status ?? "active",
      shopStatus: current === null ? null : (current.shop.status ?? "active"),
      // Not migrated yet (no role) = seller, like `accessOf`.
      roleKey: access.role ? (access.role.key ?? null) : "seller",
      roleName: access.role?.name ?? "Seller",
      permissions: [...permissions],
      isAdmin: isAdmin(access),
      shop: current ? { id: current.shop._id, name: current.shop.name, role: current.role } : null,
      shops: await Promise.all(
        shops.map(async (s) => ({
          id: s.shop._id,
          name: s.shop.name,
          logoUrl: await urlOf(ctx, s.shop.logoId),
          role: s.role,
          state: s.state,
        })),
      ),
      announcement: (await readSettings(ctx)).announcement,
    };
  },
});
