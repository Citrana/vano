import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type MutationCtx } from "./_generated/server";
import { sendTeamInviteEmail } from "./emails/teamInvite";
import { accountMutation, type AccountMutationCtx } from "./lib/access";
import { languageValidator } from "./lib/catalog";
import { normalizeEmail } from "./lib/credentials";
import { canShopDo, getEntitlements, requireCan } from "./lib/entitlements";
import { fail } from "./lib/errors";
import { urlOf } from "./lib/images";
import { notify } from "./lib/notify";
import { rateLimiter } from "./lib/rateLimits";
import { requireOwnShop, sellerMutation, sellerQuery, type SellerMutationCtx } from "./lib/seller";
import { logShopActivity } from "./lib/shopActivity";
import { findMember, membersOf, memberStates, shopAccessFor } from "./lib/shopAccess";
import {
  INVITE_TOKEN_BYTES,
  INVITE_TTL_MS,
  inviteStateAt,
  isInviteToken,
  memberLabel,
  teamRoleValidator,
  type TeamRole,
} from "./lib/team";
import { newToken, sha256Hex } from "./verification/codes";

/**
 * Team accounts (CLAUDE.md "Team accounts"). The owner invites people with
 * a one-time link, gives each a preset role and can change, suspend or
 * remove them; only the owner holds `ownTeam.manage`. Teams need the
 * `teamRoles` plan feature, and the seats come from the `teamMembers`
 * limit (`requireCan addMember`). A member the plan no longer allows is
 * paused (computed), never deleted.
 */

const PERMISSION = "ownTeam.manage" as const;
/** Upper bound on pending invites read for one shop. */
const MAX_INVITES_READ = 200;

const memberStateValidator = v.union(v.literal("active"), v.literal("suspended"), v.literal("paused"));

async function pendingInvites(ctx: MutationCtx | SellerMutationCtx, shopId: Id<"shops">) {
  return await ctx.db
    .query("shopInvites")
    .withIndex("by_shopId_and_status", (q) => q.eq("shopId", shopId).eq("status", "pending"))
    .take(MAX_INVITES_READ);
}

/** Members (any status) + pending invites that still work: what a new invite is checked against. */
async function seatsUsed(ctx: MutationCtx, shopId: Id<"shops">, now: number, except?: Id<"shopInvites">) {
  const members = await membersOf(ctx, shopId);
  const invites = (await pendingInvites(ctx, shopId)).filter((i) => i._id !== except && i.expiresAt > now);
  return members.length + invites.length;
}

async function requireShopMember(ctx: SellerMutationCtx, memberId: Id<"shopMembers">) {
  const shop = await requireOwnShop(ctx);
  const member = await ctx.db.get("shopMembers", memberId);
  if (!member || member.shopId !== shop._id) fail("NOT_FOUND");
  const user = await ctx.db.get("users", member.userId);
  return { shop, member, label: memberLabel(user) };
}

async function requireShopInvite(ctx: SellerMutationCtx, inviteId: Id<"shopInvites">) {
  const shop = await requireOwnShop(ctx);
  const invite = await ctx.db.get("shopInvites", inviteId);
  if (!invite || invite.shopId !== shop._id) fail("NOT_FOUND");
  return { shop, invite };
}

async function newInviteToken(): Promise<{ token: string; tokenHash: string }> {
  const token = newToken(INVITE_TOKEN_BYTES);
  return { token, tokenHash: await sha256Hex(token) };
}

/** The team page: members with their state, pending invites, the seat limit. */
export const overview = sellerQuery({
  permission: PERMISSION,
  args: {},
  returns: v.object({
    /** The plan includes teams (`teamRoles`). */
    entitled: v.boolean(),
    /** Seats on the plan (`teamMembers`), the owner not counted. */
    limit: v.number(),
    members: v.array(
      v.object({
        _id: v.id("shopMembers"),
        label: v.string(),
        email: v.union(v.string(), v.null()),
        role: teamRoleValidator,
        state: memberStateValidator,
        joinedAt: v.number(),
      }),
    ),
    /** Pending invites; the UI shows the expired ones as such (queries don't read the clock). */
    invites: v.array(
      v.object({
        _id: v.id("shopInvites"),
        role: teamRoleValidator,
        email: v.union(v.string(), v.null()),
        expiresAt: v.number(),
        _creationTime: v.number(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const shop = await requireOwnShop(ctx);
    const { limits } = await getEntitlements(ctx, shop);
    const members = await membersOf(ctx, shop._id);
    const states = await memberStates(ctx, shop, members);
    const rows = [];
    for (const m of members.sort((a, b) => a.joinedAt - b.joinedAt)) {
      const user = await ctx.db.get("users", m.userId);
      rows.push({
        _id: m._id,
        label: memberLabel(user),
        email: user?.email ?? null,
        role: m.role,
        state: states.get(m._id) ?? "paused",
        joinedAt: m.joinedAt,
      });
    }
    const invites = await ctx.db
      .query("shopInvites")
      .withIndex("by_shopId_and_status", (q) => q.eq("shopId", shop._id).eq("status", "pending"))
      .order("desc")
      .take(MAX_INVITES_READ);
    return {
      entitled: canShopDo(limits, { kind: "feature", feature: "teamRoles" }) === null,
      limit: limits.teamMembers,
      members: rows,
      invites: invites.map((i) => ({
        _id: i._id,
        role: i.role,
        email: i.email ?? null,
        expiresAt: i.expiresAt,
        _creationTime: i._creationTime,
      })),
    };
  },
});

/**
 * Creates a one-time invite link. The token is returned once (only its
 * hash is stored); with an email, Vano also sends it there.
 */
export const createInvite = sellerMutation({
  permission: PERMISSION,
  args: { role: teamRoleValidator, email: v.optional(v.string()), language: languageValidator },
  returns: v.object({ inviteId: v.id("shopInvites"), token: v.string(), emailSent: v.boolean() }),
  handler: async (ctx, { role, email, language }) => {
    const shop = await requireOwnShop(ctx);
    const now = Date.now();
    const to = email === undefined || email.trim() === "" ? null : normalizeEmail(email);
    if (email !== undefined && email.trim() !== "" && to === null) fail("EMAIL_INVALID");
    await requireCan(ctx, shop, { kind: "addMember", seats: await seatsUsed(ctx, shop._id, now) });
    const { ok } = await rateLimiter.limit(ctx, "teamInvite", { key: shop._id });
    if (!ok) fail("INVITE_RATE_LIMITED");

    const { token, tokenHash } = await newInviteToken();
    const inviteId = await ctx.db.insert("shopInvites", {
      shopId: shop._id,
      role,
      tokenHash,
      email: to ?? undefined,
      language,
      createdBy: ctx.user._id,
      expiresAt: now + INVITE_TTL_MS,
      status: "pending",
    });
    const emailSent = to
      ? await sendTeamInviteEmail(ctx, { to, language, inviter: ctx.user, shop, role, token })
      : false;
    await logShopActivity(ctx, shop, {
      actor: ctx.user,
      kind: "team.invited",
      targetId: inviteId,
      targetLabel: to ?? "",
      details: { role },
    });
    return { inviteId, token, emailSent };
  },
});

/** A new link (and a fresh expiry) for a pending invite; the old link stops working. */
export const renewInvite = sellerMutation({
  permission: PERMISSION,
  args: { inviteId: v.id("shopInvites") },
  returns: v.object({ token: v.string(), emailSent: v.boolean() }),
  handler: async (ctx, { inviteId }) => {
    const { shop, invite } = await requireShopInvite(ctx, inviteId);
    if (invite.status !== "pending") fail("INVITE_USED");
    const now = Date.now();
    await requireCan(ctx, shop, { kind: "addMember", seats: await seatsUsed(ctx, shop._id, now, inviteId) });
    const { ok } = await rateLimiter.limit(ctx, "teamInvite", { key: shop._id });
    if (!ok) fail("INVITE_RATE_LIMITED");
    const { token, tokenHash } = await newInviteToken();
    await ctx.db.patch("shopInvites", inviteId, { tokenHash, expiresAt: now + INVITE_TTL_MS });
    const emailSent = invite.email
      ? await sendTeamInviteEmail(ctx, {
          to: invite.email,
          language: invite.language,
          inviter: ctx.user,
          shop,
          role: invite.role,
          token,
        })
      : false;
    return { token, emailSent };
  },
});

export const revokeInvite = sellerMutation({
  permission: PERMISSION,
  args: { inviteId: v.id("shopInvites") },
  returns: v.null(),
  handler: async (ctx, { inviteId }) => {
    const { shop, invite } = await requireShopInvite(ctx, inviteId);
    if (invite.status !== "pending") return null;
    await ctx.db.patch("shopInvites", inviteId, { status: "revoked", endedAt: Date.now() });
    await logShopActivity(ctx, shop, {
      actor: ctx.user,
      kind: "team.inviteRevoked",
      targetId: inviteId,
      targetLabel: invite.email ?? "",
      details: { role: invite.role },
    });
    return null;
  },
});

async function tellMember(
  ctx: MutationCtx,
  shop: Doc<"shops">,
  member: Doc<"shopMembers">,
  change: "role" | "suspended" | "reactivated" | "removed",
  role?: TeamRole,
) {
  await notify(ctx, {
    data: { type: "team.accessChanged", shopName: shop.name, change, role },
    to: { userId: member.userId },
    dedupeKey: `team.${change}:${member._id}:${Date.now()}`,
  });
}

export const changeRole = sellerMutation({
  permission: PERMISSION,
  args: { memberId: v.id("shopMembers"), role: teamRoleValidator },
  returns: v.null(),
  handler: async (ctx, { memberId, role }) => {
    const { shop, member, label } = await requireShopMember(ctx, memberId);
    if (member.role === role) return null;
    await ctx.db.patch("shopMembers", memberId, { role });
    await logShopActivity(ctx, shop, {
      actor: ctx.user,
      kind: "team.roleChanged",
      targetId: member.userId,
      targetLabel: label,
      details: { role, previousRole: member.role },
    });
    await tellMember(ctx, shop, member, "role", role);
    return null;
  },
});

export const setSuspended = sellerMutation({
  permission: PERMISSION,
  args: { memberId: v.id("shopMembers"), suspended: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { memberId, suspended }) => {
    const { shop, member, label } = await requireShopMember(ctx, memberId);
    const status = suspended ? "suspended" : "active";
    if (member.status === status) return null;
    await ctx.db.patch("shopMembers", memberId, { status });
    await logShopActivity(ctx, shop, {
      actor: ctx.user,
      kind: suspended ? "team.suspended" : "team.reactivated",
      targetId: member.userId,
      targetLabel: label,
    });
    await tellMember(ctx, shop, member, suspended ? "suspended" : "reactivated");
    return null;
  },
});

/** Removes a member: the row is deleted, so their next call is refused at once. */
export const removeMember = sellerMutation({
  permission: PERMISSION,
  args: { memberId: v.id("shopMembers") },
  returns: v.null(),
  handler: async (ctx, { memberId }) => {
    const { shop, member, label } = await requireShopMember(ctx, memberId);
    await dropMembership(ctx, shop, member);
    await logShopActivity(ctx, shop, {
      actor: ctx.user,
      kind: "team.removed",
      targetId: member.userId,
      targetLabel: label,
      details: { role: member.role },
    });
    await tellMember(ctx, shop, member, "removed");
    return null;
  },
});

async function dropMembership(ctx: MutationCtx, shop: Doc<"shops">, member: Doc<"shopMembers">) {
  await ctx.db.delete("shopMembers", member._id);
  const user = await ctx.db.get("users", member.userId);
  if (user?.activeShopId === shop._id) await ctx.db.patch("users", user._id, { activeShopId: undefined });
}

// ---------------------------------------------------------------------------
// The invited person

/**
 * What the join page shows for a link: the shop, the role and the invite's
 * state. Public (the person may not have an account yet); never returns
 * personal data. `expiresAt` is compared by the page (queries don't read
 * the clock); accepting checks it again.
 */
export const invitePreview = query({
  args: { token: v.string() },
  returns: v.union(
    v.object({ state: v.literal("invalid") }),
    v.object({
      state: v.union(v.literal("pending"), v.literal("used"), v.literal("revoked")),
      shopName: v.string(),
      logoUrl: v.union(v.string(), v.null()),
      role: teamRoleValidator,
      expiresAt: v.number(),
      /** For a signed-in visitor: they own the shop or already belong to it. */
      relation: v.union(v.literal("owner"), v.literal("member"), v.null()),
    }),
  ),
  handler: async (ctx, { token }) => {
    if (!isInviteToken(token)) return { state: "invalid" as const };
    const tokenHash = await sha256Hex(token);
    const invite = await ctx.db
      .query("shopInvites")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    const shop = invite ? await ctx.db.get("shops", invite.shopId) : null;
    if (!invite || !shop) return { state: "invalid" as const };
    const userId = await getAuthUserId(ctx);
    const relation =
      userId === null
        ? null
        : shop.ownerId === userId
          ? ("owner" as const)
          : (await findMember(ctx, shop._id, userId))
            ? ("member" as const)
            : null;
    return {
      state: invite.status === "accepted" ? ("used" as const) : invite.status,
      shopName: shop.name,
      logoUrl: await urlOf(ctx, shop.logoId),
      role: invite.role,
      expiresAt: invite.expiresAt,
      relation,
    };
  },
});

/** Joins the shop of a valid invite (one-time). The seller screens switch to it. */
export const acceptInvite = accountMutation({
  args: { token: v.string() },
  returns: v.id("shops"),
  handler: async (ctx, { token }) => {
    if (!isInviteToken(token)) fail("INVITE_INVALID");
    const now = Date.now();
    const tokenHash = await sha256Hex(token);
    const invite = await ctx.db
      .query("shopInvites")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    const shop = invite ? await ctx.db.get("shops", invite.shopId) : null;
    if (!invite || !shop) fail("INVITE_INVALID");
    const state = inviteStateAt(invite, now);
    if (state === "used") fail("INVITE_USED");
    if (state === "revoked") fail("INVITE_INVALID");
    if (state === "expired") fail("INVITE_EXPIRED");
    if (shop.ownerId === ctx.user._id) fail("INVITE_OWN_SHOP");
    if (await findMember(ctx, shop._id, ctx.user._id)) fail("ALREADY_MEMBER");
    await requireCan(ctx, shop, { kind: "addMember", seats: await seatsUsed(ctx, shop._id, now, invite._id) });

    await ctx.db.insert("shopMembers", {
      shopId: shop._id,
      userId: ctx.user._id,
      role: invite.role,
      status: "active",
      invitedBy: invite.createdBy,
      joinedAt: now,
    });
    await ctx.db.patch("shopInvites", invite._id, {
      status: "accepted",
      acceptedBy: ctx.user._id,
      acceptedAt: now,
      endedAt: now,
    });
    await ctx.db.patch("users", ctx.user._id, { activeShopId: shop._id });
    const label = memberLabel(ctx.user);
    await logShopActivity(ctx, shop, {
      actor: ctx.user,
      kind: "team.joined",
      targetId: ctx.user._id,
      targetLabel: label,
      details: { role: invite.role },
    });
    await notify(ctx, {
      data: { type: "team.memberJoined", shopName: shop.name, member: label, role: invite.role },
      to: { shop },
      dedupeKey: `team.joined:${invite._id}`,
      exclude: [ctx.user._id],
    });
    return shop._id;
  },
});

async function requireUsableShop(ctx: AccountMutationCtx, shopId: Id<"shops">) {
  const shop = await ctx.db.get("shops", shopId);
  const access = shop ? await shopAccessFor(ctx, ctx.access, shop, Date.now()) : null;
  if (!shop || !access) fail("NOT_FOUND");
  return shop;
}

/** The shop switcher: only a shop the caller owns or can use as a member. */
export const switchShop = accountMutation({
  args: { shopId: v.id("shops") },
  returns: v.null(),
  handler: async (ctx, { shopId }) => {
    await requireUsableShop(ctx, shopId);
    if (ctx.user.activeShopId !== shopId) await ctx.db.patch("users", ctx.user._id, { activeShopId: shopId });
    return null;
  },
});

/** A member leaves a shop (any state). The owner can't leave their own shop. */
export const leaveShop = accountMutation({
  args: { shopId: v.id("shops") },
  returns: v.null(),
  handler: async (ctx, { shopId }) => {
    const shop = await ctx.db.get("shops", shopId);
    const member = shop ? await findMember(ctx, shopId, ctx.user._id) : null;
    if (!shop || !member) fail("NOT_FOUND");
    await dropMembership(ctx, shop, member);
    await logShopActivity(ctx, shop, {
      actor: ctx.user,
      kind: "team.left",
      targetId: ctx.user._id,
      targetLabel: memberLabel(ctx.user),
      details: { role: member.role },
    });
    return null;
  },
});
