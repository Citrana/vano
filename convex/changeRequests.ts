import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { logAdminAction } from "./lib/audit";
import {
  CODE_MAX_ATTEMPTS,
  CODE_TTL_MINUTES,
  VERIFIED_TTL_MINUTES,
  changeStatusValidator,
  cleanNewValue,
  inCooldown,
  protectedFieldValidator,
  reasonProblem,
  type ChangeFlag,
  type ProtectedField,
} from "./lib/changeRequests";
import { fail, type ErrorCode } from "./lib/errors";
import { notify } from "./lib/notify";
import { normalizeWhatsapp } from "./lib/phone";
import { riskyValueMatch } from "./lib/protectedNames";
import { rateLimiter } from "./lib/rateLimits";
import { requireOwnShop, sellerMutation, sellerQuery } from "./lib/seller";
import {
  currentValue,
  lastApprovedAt,
  loggedValue,
  pendingRequest,
  slugAvailableFor,
} from "./lib/shopChanges";
import { hashCode, newCode, newSalt, sameHash } from "./verification/codes";
import { activeSender, verificationTestMode } from "./verification/registry";

/**
 * Seller side of protected shop changes (CLAUDE.md "Protected shop
 * changes"): ask to change the name, link or WhatsApp number; the live
 * value only changes when an admin approves (`admin/changeRequests`).
 */

const PERMISSION = "ownShop.manage" as const;
const MINUTE_MS = 60_000;

const INVALID_CODE: Record<ProtectedField, ErrorCode> = {
  name: "NAME_INVALID",
  slug: "SLUG_INVALID",
  whatsapp: "PHONE_INVALID",
};

const sellerRequest = v.object({
  _id: v.id("shopChangeRequests"),
  _creationTime: v.number(),
  field: protectedFieldValidator,
  oldValue: v.string(),
  newValue: v.string(),
  reason: v.string(),
  status: changeStatusValidator,
  decidedAt: v.union(v.number(), v.null()),
  decisionReason: v.union(v.string(), v.null()),
});

function toSellerRequest(request: Doc<"shopChangeRequests">) {
  return {
    _id: request._id,
    _creationTime: request._creationTime,
    field: request.field,
    oldValue: request.oldValue,
    newValue: request.newValue,
    reason: request.reason,
    status: request.status,
    decidedAt: request.decidedAt ?? null,
    decisionReason: request.decisionReason ?? null,
  };
}

/**
 * The caller's requests (newest first, the last 50) and, per field, when
 * it was last changed (the client shows the cooldown warning from it).
 */
export const mine = sellerQuery({
  permission: PERMISSION,
  args: {},
  returns: v.object({
    requests: v.array(sellerRequest),
    lastApproved: v.object({
      name: v.union(v.number(), v.null()),
      slug: v.union(v.number(), v.null()),
      whatsapp: v.union(v.number(), v.null()),
    }),
    verificationAvailable: v.boolean(),
  }),
  handler: async (ctx) => {
    const shop = await requireOwnShop(ctx);
    const requests = await ctx.db
      .query("shopChangeRequests")
      .withIndex("by_shopId", (q) => q.eq("shopId", shop._id))
      .order("desc")
      .take(50);
    return {
      requests: requests.map(toSellerRequest),
      lastApproved: {
        name: await lastApprovedAt(ctx, shop._id, "name"),
        slug: await lastApprovedAt(ctx, shop._id, "slug"),
        whatsapp: await lastApprovedAt(ctx, shop._id, "whatsapp"),
      },
      verificationAvailable: activeSender() !== null,
    };
  },
});

/**
 * Asks to change a protected field. Everything is checked here: one
 * pending request per field, the value's rules, the link's availability,
 * the reason, and for WhatsApp a verified code for that exact number.
 * Risky values (brands) and requests inside the cooldown are flagged for
 * the admin, not refused.
 */
export const create = sellerMutation({
  permission: PERMISSION,
  args: {
    field: protectedFieldValidator,
    newValue: v.string(),
    reason: v.string(),
    verificationId: v.optional(v.id("phoneVerifications")),
  },
  returns: v.id("shopChangeRequests"),
  handler: async (ctx, { field, newValue, reason, verificationId }) => {
    const shop = await requireOwnShop(ctx);
    const now = Date.now();

    const cleaned = cleanNewValue(field, newValue, currentValue(shop, field));
    if ("problem" in cleaned) {
      if (cleaned.problem === "same") fail("CHANGE_SAME_VALUE");
      if (cleaned.problem === "reserved") fail("SLUG_RESERVED");
      fail(INVALID_CODE[field]);
    }
    const value = cleaned.value;
    if (reasonProblem(reason) !== null) fail("CHANGE_REASON_INVALID");
    if (await pendingRequest(ctx, shop._id, field)) fail("CHANGE_PENDING");
    if (field === "slug" && !(await slugAvailableFor(ctx, value, shop._id))) fail("SLUG_TAKEN");

    if (field === "whatsapp") {
      const verification = verificationId ? await ctx.db.get("phoneVerifications", verificationId) : null;
      const valid =
        verification !== null &&
        verification.shopId === shop._id &&
        verification.phone === value &&
        verification.verifiedAt !== undefined &&
        verification.usedAt === undefined &&
        now - verification.verifiedAt < VERIFIED_TTL_MINUTES * MINUTE_MS;
      if (!valid) fail("PHONE_NOT_VERIFIED");
      await ctx.db.patch("phoneVerifications", verification._id, { usedAt: now });
    }

    const flags: ChangeFlag[] = [];
    const brand = field === "whatsapp" ? null : riskyValueMatch(value);
    if (brand) flags.push("brand");
    if (inCooldown(await lastApprovedAt(ctx, shop._id, field), now)) flags.push("cooldown");

    const requestId = await ctx.db.insert("shopChangeRequests", {
      shopId: shop._id,
      requesterId: ctx.user._id,
      field,
      oldValue: currentValue(shop, field),
      newValue: value,
      reason: reason.trim(),
      status: "pending",
      flags,
      matchedBrand: brand ?? undefined,
      shopName: shop.name,
      searchText: [shop.name, shop.slug, field === "whatsapp" ? "" : value].join(" ").trim(),
    });
    // One notification per request: flagged (risky name or link) or plain.
    await notify(ctx, {
      data: brand
        ? { type: "changeRequest.flagged", requestId, shopName: shop.name, field, value, brand }
        : { type: "changeRequest.submitted", requestId, shopName: shop.name, field },
      to: { permission: "changeRequests.view" },
      dedupeKey: `cr.submitted:${requestId}`,
      exclude: [shop.ownerId],
    });
    await logAdminAction(ctx, {
      actor: ctx.user,
      action: "changeRequest.created",
      targetType: "shop",
      targetId: shop._id,
      targetLabel: shop.name,
      details: {
        requestId,
        field,
        newValue: loggedValue(field, value),
        flags: flags.join(",") || null,
      },
    });
    return requestId;
  },
});

/** Withdraws the caller's own pending request. Someone else's is NOT_FOUND. */
export const cancel = sellerMutation({
  permission: PERMISSION,
  args: { requestId: v.id("shopChangeRequests") },
  returns: v.null(),
  handler: async (ctx, { requestId }) => {
    const shop = await requireOwnShop(ctx);
    const request = await ctx.db.get("shopChangeRequests", requestId);
    if (!request || request.shopId !== shop._id) fail("NOT_FOUND");
    if (request.status !== "pending") fail("REQUEST_NOT_PENDING");
    await ctx.db.patch("shopChangeRequests", request._id, { status: "cancelled", decidedAt: Date.now() });
    await logAdminAction(ctx, {
      actor: ctx.user,
      action: "changeRequest.cancelled",
      targetType: "shop",
      targetId: shop._id,
      targetLabel: shop.name,
      details: { requestId, field: request.field },
    });
    return null;
  },
});

/**
 * Sends a code to the new WhatsApp number (the sender is swappable, see
 * convex/verification/registry.ts). Only a hash is stored. In test mode
 * the code is also returned so the screen can show it.
 */
export const sendPhoneCode = sellerMutation({
  permission: PERMISSION,
  args: { phone: v.string() },
  returns: v.object({
    verificationId: v.id("phoneVerifications"),
    phone: v.string(),
    devCode: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, { phone }) => {
    const shop = await requireOwnShop(ctx);
    if (activeSender() === null) fail("VERIFICATION_UNAVAILABLE");
    const normalized = normalizeWhatsapp(phone);
    if (normalized === null) fail("PHONE_INVALID");
    if (normalized === shop.whatsappNumber) fail("CHANGE_SAME_VALUE");
    if (await pendingRequest(ctx, shop._id, "whatsapp")) fail("CHANGE_PENDING");

    for (const name of ["phoneCodeBurst", "phoneCodeHourly"] as const) {
      const { ok } = await rateLimiter.limit(ctx, name, { key: shop._id });
      if (!ok) fail("CODE_RATE_LIMITED");
    }

    const code = newCode();
    const salt = newSalt();
    const verificationId = await ctx.db.insert("phoneVerifications", {
      shopId: shop._id,
      phone: normalized,
      codeHash: await hashCode(code, salt),
      salt,
      expiresAt: Date.now() + CODE_TTL_MINUTES * MINUTE_MS,
      attempts: 0,
    });
    await ctx.scheduler.runAfter(0, internal.verification.deliver.send, { phone: normalized, code });
    return { verificationId, phone: normalized, devCode: verificationTestMode() ? code : null };
  },
});

/**
 * Checks a code. Returns the problem instead of throwing, so the failed
 * attempt is counted (a thrown error would roll the count back).
 */
export const verifyPhoneCode = sellerMutation({
  permission: PERMISSION,
  args: { verificationId: v.id("phoneVerifications"), code: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({
      ok: v.literal(false),
      code: v.union(v.literal("CODE_INVALID"), v.literal("CODE_EXPIRED"), v.literal("CODE_TOO_MANY_ATTEMPTS")),
    }),
  ),
  handler: async (ctx, { verificationId, code }) => {
    const shop = await requireOwnShop(ctx);
    const verification = await ctx.db.get("phoneVerifications", verificationId);
    if (!verification || verification.shopId !== shop._id) fail("NOT_FOUND");
    if (verification.verifiedAt !== undefined && verification.usedAt === undefined) return { ok: true as const };
    if (verification.usedAt !== undefined || Date.now() > verification.expiresAt) {
      return { ok: false as const, code: "CODE_EXPIRED" as const };
    }
    if (verification.attempts >= CODE_MAX_ATTEMPTS) {
      return { ok: false as const, code: "CODE_TOO_MANY_ATTEMPTS" as const };
    }
    const matches = sameHash(await hashCode(code.trim(), verification.salt), verification.codeHash);
    if (!matches) {
      const attempts = verification.attempts + 1;
      await ctx.db.patch("phoneVerifications", verification._id, { attempts });
      return {
        ok: false as const,
        code: attempts >= CODE_MAX_ATTEMPTS ? ("CODE_TOO_MANY_ATTEMPTS" as const) : ("CODE_INVALID" as const),
      };
    }
    await ctx.db.patch("phoneVerifications", verification._id, { verifiedAt: Date.now() });
    return { ok: true as const };
  },
});
