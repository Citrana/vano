import { filter } from "convex-helpers/server/filter";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { adminMutation, adminQuery } from "../lib/access";
import { logAdminAction, type AuditAction } from "../lib/audit";
import { LIMITS } from "../lib/catalog";
import {
  DECISION_REASON_MAX,
  DECISION_REASON_MIN,
  changeFlagValidator,
  changeStatusValidator,
  cleanNewValue,
  inCooldown,
  protectedFieldValidator,
  reasonProblem,
  type ProtectedField,
} from "../lib/changeRequests";
import { fail } from "../lib/errors";
import { sortOrderValidator } from "../lib/listOrder";
import { assertNotOwnShop } from "../lib/guards";
import { notify } from "../lib/notify";
import { shopStatusValidator } from "../lib/permissions";
import {
  applyShopChange,
  currentValue,
  lastApprovedAt,
  loggedValue,
  slugAvailableFor,
} from "../lib/shopChanges";

/**
 * Admin side of protected shop changes (CLAUDE.md "Protected shop
 * changes"). Viewing needs `changeRequests.view`; approving or rejecting
 * needs `changeRequests.decide`, never on your own shop.
 */

const row = v.object({
  _id: v.id("shopChangeRequests"),
  _creationTime: v.number(),
  shopId: v.id("shops"),
  shopName: v.string(),
  field: protectedFieldValidator,
  oldValue: v.string(),
  newValue: v.string(),
  status: changeStatusValidator,
  flags: v.array(changeFlagValidator),
  matchedBrand: v.union(v.string(), v.null()),
  decidedAt: v.union(v.number(), v.null()),
});

function toRow(request: Doc<"shopChangeRequests">) {
  return {
    _id: request._id,
    _creationTime: request._creationTime,
    shopId: request.shopId,
    shopName: request.shopName,
    field: request.field,
    oldValue: request.oldValue,
    newValue: request.newValue,
    status: request.status,
    flags: request.flags,
    matchedBrand: request.matchedBrand ?? null,
    decidedAt: request.decidedAt ?? null,
  };
}

/**
 * Newest first (`order: "asc"` for oldest first). Filters: status, field,
 * created in [`from`, `to`), flagged (a risky name or link: the "brand"
 * flag); search: shop name, link, new value (by relevance, no order).
 */
export const list = adminQuery({
  permission: "changeRequests.view",
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(changeStatusValidator),
    field: v.optional(protectedFieldValidator),
    search: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    flagged: v.optional(v.boolean()),
    order: v.optional(sortOrderValidator),
  },
  returns: paginationResultValidator(row),
  handler: async (ctx, { paginationOpts, status, field, search, from, to, flagged, order }) => {
    const keep = (r: Doc<"shopChangeRequests">) => !flagged || r.flags.includes("brand");
    const text = search?.trim();
    if (text) {
      const searched = ctx.db
        .query("shopChangeRequests")
        .withSearchIndex("search_text", (q) => {
          let s = q.search("searchText", text);
          if (status) s = s.eq("status", status);
          if (field) s = s.eq("field", field);
          return s;
        })
        .filter((q) =>
          q.and(
            from === undefined ? true : q.gte(q.field("_creationTime"), from),
            to === undefined ? true : q.lt(q.field("_creationTime"), to),
          ),
        );
      const result = await filter(searched, keep).paginate(paginationOpts);
      return { ...result, page: result.page.map(toRow) };
    }

    const lo = from ?? 0;
    const hi = to ?? Number.MAX_SAFE_INTEGER;
    const base = ctx.db.query("shopChangeRequests");
    const query =
      status && field
        ? base.withIndex("by_field_and_status", (q) =>
            q.eq("field", field).eq("status", status).gte("_creationTime", lo).lt("_creationTime", hi),
          )
        : status
          ? base.withIndex("by_status", (q) => q.eq("status", status).gte("_creationTime", lo).lt("_creationTime", hi))
          : field
            ? base.withIndex("by_field", (q) => q.eq("field", field).gte("_creationTime", lo).lt("_creationTime", hi))
            : base.withIndex("by_creation_time", (q) => q.gte("_creationTime", lo).lt("_creationTime", hi));
    const result = await filter(query.order(order ?? "desc"), keep).paginate(paginationOpts);
    return { ...result, page: result.page.map(toRow) };
  },
});

/** Other pending requests asking for the same link (bounded scan). */
async function competingSlugRequests(ctx: QueryCtx, request: Doc<"shopChangeRequests">): Promise<number> {
  if (request.field !== "slug" || request.status !== "pending") return 0;
  const pending = await ctx.db
    .query("shopChangeRequests")
    .withIndex("by_field_and_status", (q) => q.eq("field", "slug").eq("status", "pending"))
    .take(200);
  return pending.filter((r) => r._id !== request._id && r.newValue === request.newValue).length;
}

/** One request with what the admin needs to decide. Null if unknown. */
export const get = adminQuery({
  permission: "changeRequests.view",
  args: { requestId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      request: row.extend({
        reason: v.string(),
        decisionReason: v.union(v.string(), v.null()),
        decidedByEmail: v.union(v.string(), v.null()),
        cooldownOverridden: v.boolean(),
      }),
      shop: v.object({
        _id: v.id("shops"),
        _creationTime: v.number(),
        name: v.string(),
        slug: v.string(),
        status: shopStatusValidator,
        currentValue: v.string(),
        productCount: v.number(),
        /** True when there are more products than counted. */
        productCountCapped: v.boolean(),
        ownerEmail: v.union(v.string(), v.null()),
      }),
      history: v.array(row),
      lastApprovedAt: v.union(v.number(), v.null()),
      /** For a pending link change: still free right now? */
      slugAvailable: v.union(v.boolean(), v.null()),
      competingRequests: v.number(),
      isOwnShop: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const requestId = ctx.db.normalizeId("shopChangeRequests", args.requestId);
    const request = requestId ? await ctx.db.get("shopChangeRequests", requestId) : null;
    if (!request) return null;
    const shop = await ctx.db.get("shops", request.shopId);
    if (!shop) return null;
    const [owner, decidedBy, products, history] = await Promise.all([
      ctx.db.get("users", shop.ownerId),
      request.decidedById ? ctx.db.get("users", request.decidedById) : null,
      ctx.db
        .query("products")
        .withIndex("by_shopId", (q) => q.eq("shopId", shop._id))
        .take(LIMITS.maxProducts + 1),
      ctx.db
        .query("shopChangeRequests")
        .withIndex("by_shopId", (q) => q.eq("shopId", shop._id))
        .order("desc")
        .take(21),
    ]);
    return {
      request: {
        ...toRow(request),
        reason: request.reason,
        decisionReason: request.decisionReason ?? null,
        decidedByEmail: decidedBy?.email ?? null,
        cooldownOverridden: request.cooldownOverridden ?? false,
      },
      shop: {
        _id: shop._id,
        _creationTime: shop._creationTime,
        name: shop.name,
        slug: shop.slug,
        status: shop.status ?? "active",
        currentValue: currentValue(shop, request.field),
        productCount: Math.min(products.length, LIMITS.maxProducts),
        productCountCapped: products.length > LIMITS.maxProducts,
        ownerEmail: owner?.email ?? null,
      },
      history: history.filter((r) => r._id !== request._id).slice(0, 20).map(toRow),
      lastApprovedAt: await lastApprovedAt(ctx, shop._id, request.field),
      slugAvailable:
        request.field === "slug" && request.status === "pending"
          ? await slugAvailableFor(ctx, request.newValue, shop._id)
          : null,
      competingRequests: await competingSlugRequests(ctx, request),
      isOwnShop: shop.ownerId === ctx.user._id,
    };
  },
});

const APPLIED_ACTION: Record<ProtectedField, AuditAction> = {
  name: "shop.nameChanged",
  slug: "shop.slugChanged",
  whatsapp: "shop.whatsappChanged",
};

async function loadPending(ctx: QueryCtx, requestId: Doc<"shopChangeRequests">["_id"]) {
  const request = await ctx.db.get("shopChangeRequests", requestId);
  if (!request) fail("NOT_FOUND");
  if (request.status !== "pending") fail("REQUEST_NOT_PENDING");
  const shop = await ctx.db.get("shops", request.shopId);
  if (!shop) fail("NOT_FOUND");
  return { request, shop };
}

/**
 * Approves and applies the change in one transaction. The value is checked
 * again now (rules, link still free). Inside the cooldown it needs
 * `overrideCooldown`, which is logged.
 */
export const approve = adminMutation({
  permission: "changeRequests.decide",
  args: { requestId: v.id("shopChangeRequests"), overrideCooldown: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { requestId, overrideCooldown }) => {
    const { request, shop } = await loadPending(ctx, requestId);
    assertNotOwnShop(ctx.access, shop);
    const now = Date.now();
    const cooling = inCooldown(await lastApprovedAt(ctx, shop._id, request.field), now);
    if (cooling && !overrideCooldown) fail("CHANGE_COOLDOWN");

    const oldValue = currentValue(shop, request.field);
    const cleaned = cleanNewValue(request.field, request.newValue, oldValue);
    if ("problem" in cleaned) {
      if (cleaned.problem === "same") fail("CHANGE_SAME_VALUE");
      if (cleaned.problem === "reserved") fail("SLUG_RESERVED");
      fail(request.field === "slug" ? "SLUG_INVALID" : request.field === "name" ? "NAME_INVALID" : "PHONE_INVALID");
    }
    await applyShopChange(ctx, shop, request.field, cleaned.value, now);

    await ctx.db.patch("shopChangeRequests", request._id, {
      status: "approved",
      decidedById: ctx.user._id,
      decidedAt: now,
      cooldownOverridden: cooling ? true : undefined,
    });
    await notify(ctx, {
      data: {
        type: "changeRequest.approved",
        requestId: request._id,
        field: request.field,
        value: loggedValue(request.field, cleaned.value),
      },
      to: { userId: shop.ownerId },
      dedupeKey: `cr.decided:${request._id}`,
    });
    const common = { targetType: "shop" as const, targetId: shop._id, targetLabel: shop.name, actor: ctx.user };
    await logAdminAction(ctx, {
      ...common,
      action: "changeRequest.approved",
      details: { requestId, field: request.field, cooldownOverridden: cooling },
    });
    await logAdminAction(ctx, {
      ...common,
      action: APPLIED_ACTION[request.field],
      details: {
        requestId,
        from: loggedValue(request.field, oldValue),
        to: loggedValue(request.field, cleaned.value),
      },
    });
    return null;
  },
});

/** Rejects with a reason the seller will see. Nothing changes on the shop. */
export const reject = adminMutation({
  permission: "changeRequests.decide",
  args: { requestId: v.id("shopChangeRequests"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { requestId, reason }) => {
    if (reasonProblem(reason, DECISION_REASON_MIN, DECISION_REASON_MAX) !== null) fail("REASON_INVALID");
    const { request, shop } = await loadPending(ctx, requestId);
    assertNotOwnShop(ctx.access, shop);
    const cleanReason = reason.trim();
    await ctx.db.patch("shopChangeRequests", request._id, {
      status: "rejected",
      decidedById: ctx.user._id,
      decidedAt: Date.now(),
      decisionReason: cleanReason,
    });
    await notify(ctx, {
      data: {
        type: "changeRequest.rejected",
        requestId: request._id,
        field: request.field,
        value: loggedValue(request.field, request.newValue),
        reason: cleanReason,
      },
      to: { userId: shop.ownerId },
      dedupeKey: `cr.decided:${request._id}`,
    });
    await logAdminAction(ctx, {
      actor: ctx.user,
      action: "changeRequest.rejected",
      targetType: "shop",
      targetId: shop._id,
      targetLabel: shop.name,
      details: { requestId, field: request.field, reason: cleanReason },
    });
    return null;
  },
});
