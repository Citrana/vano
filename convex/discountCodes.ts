import { v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { categoryValidator } from "./lib/catalog";
import { codeTextProblem, normalizeCode } from "./lib/discountCodes/code";
import { CODES_MAX, codeScheduleProblem, maxUsesProblem } from "./lib/discountCodes/rules";
import { codeByText, deleteCode, shopCodes, writeCodeLiveAndSchedule } from "./lib/discountCodes/store";
import { codeDiscountValidator, codeInputFields, codeTargetValidator } from "./lib/discountCodes/validators";
import { hasFeature, hiddenFromShop, requireCan, shopProducts } from "./lib/entitlements";
import { fail } from "./lib/errors";
import { currencyValidator } from "./lib/money";
import { affectedProducts } from "./lib/sales/active";
import { discountProblem } from "./lib/sales/discount";
import { pickerProducts } from "./lib/sales/store";
import { pickerProductValidator, type SaleTarget } from "./lib/sales/validators";
import {
  requireOwnShop,
  sellerMutation,
  sellerQuery,
  type SellerMutationCtx,
  type SellerQueryCtx,
} from "./lib/seller";
import { logShopActivity } from "./lib/shopActivity";
import type { ActivityKind } from "./lib/team";

/**
 * The seller's discount codes (CLAUDE.md "Discount codes"). A code gives
 * customers a temporary price on top of the products' real prices (never
 * changed). Creating, editing and resuming need the `discountCodes` plan
 * feature (Business); pausing and deleting work on any plan, so a shop
 * that moved down keeps control of the codes it saved. Every write stores
 * the `live` flag and schedules `discountCodeJobs.sync` at start / end.
 */

const PERMISSION = "ownOffers.manage" as const;

const codeFields = {
  _id: v.id("discountCodes"),
  code: v.string(),
  discount: codeDiscountValidator,
  target: codeTargetValidator,
  startsAt: v.number(),
  endsAt: v.number(),
  maxUses: v.union(v.number(), v.null()),
  uses: v.number(),
  paused: v.boolean(),
  adminPause: v.union(v.object({ at: v.number(), reason: v.string() }), v.null()),
  live: v.boolean(),
  version: v.number(),
};
const codeValidator = v.object(codeFields);
export type SellerCode = Infer<typeof codeValidator>;

function toCode(code: Doc<"discountCodes">): SellerCode {
  return {
    _id: code._id,
    code: code.code,
    discount: code.discount,
    target: code.target,
    startsAt: code.startsAt,
    endsAt: code.endsAt,
    maxUses: code.maxUses ?? null,
    uses: code.uses,
    paused: code.paused,
    adminPause: code.adminPause ?? null,
    live: code.live,
    version: code.version,
  };
}

/** A code of the caller's shop; someone else's is NOT_FOUND. */
async function requireOwnCode(ctx: SellerQueryCtx, codeId: Id<"discountCodes">) {
  const shop = await requireOwnShop(ctx);
  const code = await ctx.db.get("discountCodes", codeId);
  if (!code || code.shopId !== shop._id) fail("NOT_FOUND");
  return { shop, code };
}

/** The codes list: every saved code with its product count and uses. */
export const listMine = sellerQuery({
  permission: PERMISSION,
  args: {},
  returns: v.object({
    entitled: v.boolean(),
    currency: currencyValidator,
    codes: v.array(v.object({ ...codeFields, products: v.number() })),
  }),
  handler: async (ctx) => {
    const shop = await requireOwnShop(ctx);
    const products = (await shopProducts(ctx, shop._id)).filter((p) => !hiddenFromShop(p));
    const codes = (await shopCodes(ctx, shop._id)).map((code) => ({
      ...toCode(code),
      products: affectedProducts(code, products, shop.currency).length,
    }));
    return { entitled: await hasFeature(ctx, shop, "discountCodes"), currency: shop.currency, codes };
  },
});

/**
 * What the code editor needs: the shop's products and categories, how
 * many codes are saved and the code being edited (null when creating, or
 * when the id isn't the caller's).
 */
export const editor = sellerQuery({
  permission: PERMISSION,
  args: { codeId: v.optional(v.string()) },
  returns: v.object({
    entitled: v.boolean(),
    currency: currencyValidator,
    categories: v.array(categoryValidator),
    codesCount: v.number(),
    products: v.array(pickerProductValidator),
    code: v.union(codeValidator, v.null()),
  }),
  handler: async (ctx, args) => {
    const shop = await requireOwnShop(ctx);
    const codes = await shopCodes(ctx, shop._id);
    const codeId = args.codeId === undefined ? null : ctx.db.normalizeId("discountCodes", args.codeId);
    const code = codeId ? (codes.find((c) => c._id === codeId) ?? null) : null;
    return {
      entitled: await hasFeature(ctx, shop, "discountCodes"),
      currency: shop.currency,
      categories: shop.categories,
      codesCount: codes.length,
      products: await pickerProducts(ctx, shop._id),
      code: code ? toCode(code) : null,
    };
  },
});

type CodeInput = {
  code: string;
  discount: Doc<"discountCodes">["discount"];
  target: SaleTarget;
  startsAt?: number;
  endsAt: number;
  maxUses?: number;
};

/**
 * Checks and cleans what the seller sent (the editor runs the same pure
 * rules first). The text must be free in the shop, products must be the
 * shop's, chosen products must all be lowered, at least one product must
 * be lowered, and the maximum can't go below the uses so far.
 */
async function cleanCodeInput(
  ctx: SellerQueryCtx,
  shop: Doc<"shops">,
  input: CodeInput,
  now: number,
  existing?: Doc<"discountCodes">,
) {
  const code = normalizeCode(input.code);
  if (codeTextProblem(code) !== null) fail("DISCOUNT_CODE_INVALID");
  const holder = await codeByText(ctx, shop._id, code);
  if (holder && holder._id !== existing?._id) fail("DISCOUNT_CODE_TAKEN");
  if (discountProblem(input.discount) !== null) fail("DISCOUNT_CODE_DISCOUNT_INVALID");

  const products = await shopProducts(ctx, shop._id);
  const own = new Set<Id<"products">>(products.map((p) => p._id));
  const ownIds = (ids: readonly Id<"products">[]) => {
    const unique = [...new Set(ids)];
    if (unique.some((id) => !own.has(id))) fail("NOT_FOUND");
    return unique;
  };
  const t = input.target;
  const target: SaleTarget =
    t.kind === "products"
      ? { kind: "products", productIds: ownIds(t.productIds) }
      : t.kind === "category"
        ? { kind: "category", category: t.category, excludedIds: ownIds(t.excludedIds) }
        : { kind: "shop", excludedIds: ownIds(t.excludedIds) };

  // A code that already started keeps its start; "start now" = now.
  const keepStart = existing && existing.startsAt <= now ? existing.startsAt : undefined;
  const startsAt = input.startsAt ?? keepStart ?? now;
  if (codeScheduleProblem({ startsAt: input.startsAt, endsAt: input.endsAt }, now) !== null) {
    fail("DISCOUNT_CODE_SCHEDULE_INVALID");
  }
  if (maxUsesProblem(input.maxUses, existing?.uses ?? 0) !== null) fail("DISCOUNT_CODE_MAX_USES_INVALID");

  const shown = products.filter((p) => !hiddenFromShop(p));
  const affected = affectedProducts({ discount: input.discount, target }, shown, shop.currency);
  if (target.kind === "products") {
    const chosen = shown.filter((p) => target.productIds.includes(p._id));
    if (affected.length < chosen.length) fail("DISCOUNT_CODE_DISCOUNT_INVALID");
  }
  if (affected.length === 0) fail("DISCOUNT_CODE_NO_PRODUCTS");
  return { code, discount: input.discount, target, startsAt, endsAt: input.endsAt, maxUses: input.maxUses };
}

/** One line in the shop's activity history (CLAUDE.md "Team accounts"). */
async function logCode(
  ctx: SellerMutationCtx,
  shopId: Id<"shops">,
  kind: ActivityKind,
  codeId: Id<"discountCodes">,
  code: string,
) {
  await logShopActivity(ctx, { _id: shopId }, { actor: ctx.user, kind, targetId: codeId, targetLabel: code });
}

export const create = sellerMutation({
  permission: PERMISSION,
  args: codeInputFields,
  returns: v.id("discountCodes"),
  handler: async (ctx, input) => {
    const shop = await requireOwnShop(ctx);
    await requireCan(ctx, shop, { kind: "feature", feature: "discountCodes" });
    if ((await shopCodes(ctx, shop._id)).length >= CODES_MAX) fail("TOO_MANY_DISCOUNT_CODES");
    const now = Date.now();
    const fields = await cleanCodeInput(ctx, shop, input, now);
    const codeId = await ctx.db.insert("discountCodes", {
      shopId: shop._id,
      ...fields,
      uses: 0,
      paused: false,
      live: false,
      version: 1,
      updatedAt: now,
    });
    await writeCodeLiveAndSchedule(ctx, (await ctx.db.get("discountCodes", codeId))!, now);
    await logCode(ctx, shop._id, "code.created", codeId, fields.code);
    return codeId;
  },
});

/**
 * Edits a code. `expectedVersion` is the version the editor opened: if
 * someone else saved in between (another phone, an admin pause), the
 * edit is refused with DISCOUNT_CODE_STALE. Uses are kept.
 */
export const update = sellerMutation({
  permission: PERMISSION,
  args: { codeId: v.id("discountCodes"), expectedVersion: v.number(), ...codeInputFields },
  returns: v.null(),
  handler: async (ctx, { codeId, expectedVersion, ...input }) => {
    const { shop, code } = await requireOwnCode(ctx, codeId);
    await requireCan(ctx, shop, { kind: "feature", feature: "discountCodes" });
    if (code.version !== expectedVersion) fail("DISCOUNT_CODE_STALE");
    const now = Date.now();
    const fields = await cleanCodeInput(ctx, shop, input, now, code);
    await ctx.db.patch("discountCodes", codeId, { ...fields, version: code.version + 1, updatedAt: now });
    await writeCodeLiveAndSchedule(ctx, (await ctx.db.get("discountCodes", codeId))!, now);
    await logCode(ctx, shop._id, "code.updated", codeId, fields.code);
    return null;
  },
});

export const pause = sellerMutation({
  permission: PERMISSION,
  args: { codeId: v.id("discountCodes") },
  returns: v.null(),
  handler: async (ctx, { codeId }) => {
    const { code } = await requireOwnCode(ctx, codeId);
    if (code.paused) return null;
    const now = Date.now();
    await ctx.db.patch("discountCodes", codeId, { paused: true, version: code.version + 1, updatedAt: now });
    await writeCodeLiveAndSchedule(ctx, (await ctx.db.get("discountCodes", codeId))!, now);
    await logCode(ctx, code.shopId, "code.paused", codeId, code.code);
    return null;
  },
});

/**
 * Resumes a code paused by the seller or by an admin (the seller was told
 * why; they can fix it and resume). Needs the plan feature.
 */
export const resume = sellerMutation({
  permission: PERMISSION,
  args: { codeId: v.id("discountCodes") },
  returns: v.null(),
  handler: async (ctx, { codeId }) => {
    const { shop, code } = await requireOwnCode(ctx, codeId);
    if (!code.paused && code.adminPause === undefined) return null;
    await requireCan(ctx, shop, { kind: "feature", feature: "discountCodes" });
    const now = Date.now();
    await ctx.db.patch("discountCodes", codeId, {
      paused: false,
      adminPause: undefined,
      version: code.version + 1,
      updatedAt: now,
    });
    await writeCodeLiveAndSchedule(ctx, (await ctx.db.get("discountCodes", codeId))!, now);
    await logCode(ctx, shop._id, "code.resumed", codeId, code.code);
    return null;
  },
});

export const remove = sellerMutation({
  permission: PERMISSION,
  args: { codeId: v.id("discountCodes") },
  returns: v.null(),
  handler: async (ctx, { codeId }) => {
    const { code } = await requireOwnCode(ctx, codeId);
    await deleteCode(ctx, code);
    await logCode(ctx, code.shopId, "code.deleted", codeId, code.code);
    return null;
  },
});
