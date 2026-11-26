import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { SELLER_PERMISSIONS, type Permission } from "./permissions";

/**
 * Team accounts (CLAUDE.md "Team accounts"): the ONE place for the preset
 * team roles, invite rules and activity kinds. Pure: shared by the server,
 * the team page and the tests.
 *
 * The shop owner is never a stored member: they always hold every seller
 * permission. A member's permissions in a shop are their global role's
 * seller permissions intersected with their team role's.
 */

export const TEAM_ROLE_IDS = ["manager", "seller", "editor", "viewer"] as const;
export type TeamRole = (typeof TEAM_ROLE_IDS)[number];
export const teamRoleValidator = v.union(
  v.literal("manager"),
  v.literal("seller"),
  v.literal("editor"),
  v.literal("viewer"),
);

export const memberStatusValidator = v.union(v.literal("active"), v.literal("suspended"));
export type MemberStatus = Infer<typeof memberStatusValidator>;

/** What a member sees: `paused` is computed from the plan, never stored. */
export type MemberState = MemberStatus | "paused";

export const inviteStatusValidator = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("revoked"),
);

/**
 * The preset roles. Manager: everything but plan / billing / team. Seller:
 * record sales, customers, view products. Editor: products, offers, shop
 * look (no sales or reports). Viewer: stats and reports only.
 */
export const TEAM_ROLES: Record<TeamRole, readonly Permission[]> = {
  manager: [
    "ownShop.view",
    "ownShop.manage",
    "ownProducts.view",
    "ownProducts.manage",
    "ownOffers.manage",
    "ownLook.manage",
    "ownStats.view",
    "ownSales.manage",
    "ownCustomers.view",
    "ownReports.view",
    "ownActivity.view",
  ],
  seller: ["ownShop.view", "ownProducts.view", "ownSales.manage", "ownCustomers.view"],
  editor: ["ownShop.view", "ownProducts.view", "ownProducts.manage", "ownOffers.manage", "ownLook.manage"],
  viewer: ["ownShop.view", "ownStats.view", "ownReports.view"],
};

/** Permissions only the owner ever has (never in a preset). */
export const OWNER_ONLY: readonly Permission[] = SELLER_PERMISSIONS.filter(
  (p) => !TEAM_ROLE_IDS.some((role) => TEAM_ROLES[role].includes(p)),
);

/** The seller permissions of someone in a shop: the owner gets them all. */
export function shopRolePermissions(role: TeamRole | "owner"): readonly Permission[] {
  return role === "owner" ? SELLER_PERMISSIONS : TEAM_ROLES[role];
}

/** How long an invite link works. */
export const INVITE_TTL_DAYS = 7;
export const INVITE_TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;
/** Expired / used / revoked invites are deleted this long after their end. */
export const INVITE_KEEP_DAYS = 30;
/** Activity rows older than this are deleted by `teamJobs.cleanup`. */
export const ACTIVITY_RETENTION_DAYS = 365;
/** Upper bound on member rows read for one shop (the plan ceiling is 100). */
export const MAX_MEMBERS_READ = 200;
/** Upper bound on the shops one person is listed in (switcher). */
export const MAX_MEMBERSHIPS_READ = 50;
/** Invite token: random bytes, hex encoded (only its SHA-256 is stored). */
export const INVITE_TOKEN_BYTES = 32;

/** A token from a link: exactly 64 lowercase hex characters. */
export function isInviteToken(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

/** Where the invite link points (the `join` route, reserved in `slug.ts`). */
export function invitePath(token: string): string {
  return `/join/${token}`;
}

/** How a person is shown to their team: their name, else their email. */
export function memberLabel(user: Pick<Doc<"users">, "name" | "email"> | null): string {
  const name = user?.name?.trim();
  if (name) return name;
  return user?.email ?? "—";
}

export type InviteState = "valid" | "expired" | "used" | "revoked";

/** Pure: whether an invite can still be accepted at `now`. */
export function inviteStateAt(
  invite: Pick<Doc<"shopInvites">, "status" | "expiresAt">,
  now: number,
): InviteState {
  if (invite.status === "accepted") return "used";
  if (invite.status === "revoked") return "revoked";
  return invite.expiresAt <= now ? "expired" : "valid";
}

/**
 * Who did what in a shop (`shopActivity`, written only by
 * `logShopActivity`). Labels: `Activity.kinds.<kind>`.
 */
export const ACTIVITY_KINDS = [
  "product.created",
  "product.updated",
  "product.deleted",
  "product.soldOut",
  "product.backOnSale",
  "product.hidden",
  "product.shown",
  "product.featured",
  "product.unfeatured",
  "offer.created",
  "offer.updated",
  "offer.paused",
  "offer.resumed",
  "offer.deleted",
  "code.created",
  "code.updated",
  "code.paused",
  "code.resumed",
  "code.deleted",
  "sale.recorded",
  "sale.edited",
  "sale.reversed",
  "shop.settingsUpdated",
  "shop.changeRequested",
  "look.published",
  "promoBar.saved",
  "team.invited",
  "team.inviteRevoked",
  "team.joined",
  "team.roleChanged",
  "team.suspended",
  "team.reactivated",
  "team.removed",
  "team.left",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const activityKindValidator = v.union(
  v.literal("product.created"),
  v.literal("product.updated"),
  v.literal("product.deleted"),
  v.literal("product.soldOut"),
  v.literal("product.backOnSale"),
  v.literal("product.hidden"),
  v.literal("product.shown"),
  v.literal("product.featured"),
  v.literal("product.unfeatured"),
  v.literal("offer.created"),
  v.literal("offer.updated"),
  v.literal("offer.paused"),
  v.literal("offer.resumed"),
  v.literal("offer.deleted"),
  v.literal("code.created"),
  v.literal("code.updated"),
  v.literal("code.paused"),
  v.literal("code.resumed"),
  v.literal("code.deleted"),
  v.literal("sale.recorded"),
  v.literal("sale.edited"),
  v.literal("sale.reversed"),
  v.literal("shop.settingsUpdated"),
  v.literal("shop.changeRequested"),
  v.literal("look.published"),
  v.literal("promoBar.saved"),
  v.literal("team.invited"),
  v.literal("team.inviteRevoked"),
  v.literal("team.joined"),
  v.literal("team.roleChanged"),
  v.literal("team.suspended"),
  v.literal("team.reactivated"),
  v.literal("team.removed"),
  v.literal("team.left"),
);

/** Short extra values an activity line needs (never personal data beyond the team). */
export const activityDetailsValidator = v.object({
  role: v.optional(teamRoleValidator),
  previousRole: v.optional(teamRoleValidator),
  /** A protected field (change request). */
  field: v.optional(v.string()),
});
export type ActivityDetails = Infer<typeof activityDetailsValidator>;
