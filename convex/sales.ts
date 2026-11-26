import { v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { categoryValidator } from "./lib/catalog";
import { hasFeature, hiddenFromShop, requireCan, shopProducts } from "./lib/entitlements";
import { fail } from "./lib/errors";
import { currencyValidator } from "./lib/money";
import { affectedProducts, overlappingSales } from "./lib/sales/active";
import { discountProblem, isSteep } from "./lib/sales/discount";
import { SALES_MAX, saleNameProblem, saleScheduleProblem } from "./lib/sales/rules";
import { deleteSale, pickerProducts, saleTotals, shopSales, writeLiveAndSchedule } from "./lib/sales/store";
import {
  saleDiscountValidator,
  saleDisplayValidator,
  pickerProductValidator,
  saleInputFields,
  saleTargetValidator,
  type SaleTarget,
} from "./lib/sales/validators";
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
 * The seller's sales (CLAUDE.md "Sales"). A sale adds a temporary price
 * on top of the products' real prices (never changed). Creating, editing,
 * duplicating and resuming need the `salesPromotions` plan feature;
 * pausing and deleting work on any plan, so a Free shop keeps control of
 * the sales it saved. Every write stores the `live` flag and schedules
 * `saleJobs.sync` at the start / end, so the price changes on time even
 * if nobody opens the app.
 */

const PERMISSION = "ownOffers.manage" as const;

const saleFields = {
  _id: v.id("sales"),
  name: v.string(),
  discount: saleDiscountValidator,
  target: saleTargetValidator,
  startsAt: v.number(),
  endsAt: v.number(),
  paused: v.boolean(),
  adminPause: v.union(v.object({ at: v.number(), reason: v.string() }), v.null()),
  display: saleDisplayValidator,
  live: v.boolean(),
  version: v.number(),
};
const saleValidator = v.object(saleFields);
export type SellerSale = Infer<typeof saleValidator>;

function toSale(sale: Doc<"sales">): SellerSale {
  return {
    _id: sale._id,
    name: sale.name,
    discount: sale.discount,
    target: sale.target,
    startsAt: sale.startsAt,
    endsAt: sale.endsAt,
    paused: sale.paused,
    adminPause: sale.adminPause ?? null,
    display: sale.display,
    live: sale.live,
    version: sale.version,
  };
}

/** A sale of the caller's shop; someone else's is NOT_FOUND. */
async function requireOwnSale(ctx: SellerQueryCtx, saleId: Id<"sales">) {
  const shop = await requireOwnShop(ctx);
  const sale = await ctx.db.get("sales", saleId);
  if (!sale || sale.shopId !== shop._id) fail("NOT_FOUND");
  return { shop, sale };
}

/** The sales list: every saved sale with its product count and numbers. */
export const listMine = sellerQuery({
  permission: PERMISSION,
  args: {},
  returns: v.object({
    entitled: v.boolean(),
    currency: currencyValidator,
    sales: v.array(
      v.object({
        ...saleFields,
        products: v.number(),
        overlaps: v.number(),
        views: v.number(),
        whatsappClicks: v.number(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const shop = await requireOwnShop(ctx);
    const sales = await shopSales(ctx, shop._id);
    const products = (await shopProducts(ctx, shop._id)).filter((p) => !hiddenFromShop(p));
    const rows = [];
    for (const sale of sales) {
      const totals = await saleTotals(ctx, sale._id);
      rows.push({
        ...toSale(sale),
        products: affectedProducts(sale, products, shop.currency).length,
        overlaps: overlappingSales(sale, sales, products, shop.currency).length,
        ...totals,
      });
    }
    return { entitled: await hasFeature(ctx, shop, "salesPromotions"), currency: shop.currency, sales: rows };
  },
});

/**
 * What the sale editor needs: the shop's products (for the picker, the
 * preview and the overview), its other sales (overlap note) and the sale
 * being edited (null when creating, or when the id isn't the caller's).
 */
export const editor = sellerQuery({
  permission: PERMISSION,
  args: { saleId: v.optional(v.string()) },
  returns: v.object({
    entitled: v.boolean(),
    currency: currencyValidator,
    categories: v.array(categoryValidator),
    salesCount: v.number(),
    products: v.array(pickerProductValidator),
    others: v.array(saleValidator),
    sale: v.union(saleValidator, v.null()),
  }),
  handler: async (ctx, args) => {
    const shop = await requireOwnShop(ctx);
    const sales = await shopSales(ctx, shop._id);
    const saleId = args.saleId === undefined ? null : ctx.db.normalizeId("sales", args.saleId);
    const sale = saleId ? (sales.find((s) => s._id === saleId) ?? null) : null;
    const products = await pickerProducts(ctx, shop._id);
    return {
      entitled: await hasFeature(ctx, shop, "salesPromotions"),
      currency: shop.currency,
      categories: shop.categories,
      salesCount: sales.length,
      products,
      others: sales.filter((s) => s._id !== sale?._id).map(toSale),
      sale: sale ? toSale(sale) : null,
    };
  },
});

type SaleInput = {
  name: string;
  discount: Doc<"sales">["discount"];
  target: SaleTarget;
  startsAt?: number;
  endsAt: number;
  display: Doc<"sales">["display"];
  steepConfirmed: boolean;
};

/**
 * Checks and cleans what the seller sent (the editor runs the same pure
 * rules first). Products must be the shop's; a category / whole-shop sale
 * skips products it doesn't lower, chosen products must all be lowered.
 */
function cleanSaleInput(
  shop: Doc<"shops">,
  products: readonly Doc<"products">[],
  input: SaleInput,
  now: number,
  keepStart?: number,
) {
  if (saleNameProblem(input.name) !== null) fail("SALE_NAME_INVALID");
  if (discountProblem(input.discount) !== null) fail("SALE_DISCOUNT_INVALID");

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

  // A running sale keeps its start; "start now" = now.
  const startsAt = input.startsAt ?? keepStart ?? now;
  if (saleScheduleProblem({ startsAt: input.startsAt, endsAt: input.endsAt }, now) !== null) {
    fail("SALE_SCHEDULE_INVALID");
  }

  const shown = products.filter((p) => !hiddenFromShop(p));
  const affected = affectedProducts({ discount: input.discount, target }, shown, shop.currency);
  if (target.kind === "products") {
    // Every chosen product must get a lower price (else the seller typed a wrong amount).
    const chosen = shown.filter((p) => target.productIds.includes(p._id));
    if (affected.length < chosen.length) fail("SALE_DISCOUNT_INVALID");
  }
  if (affected.length === 0) fail("SALE_NO_PRODUCTS");
  if (!input.steepConfirmed && affected.some((a) => isSteep(a.product.price, a.price))) {
    fail("SALE_STEEP_UNCONFIRMED");
  }
  return {
    name: input.name.trim(),
    discount: input.discount,
    target,
    startsAt,
    endsAt: input.endsAt,
    display: input.display,
  };
}

/** One line in the shop's activity history (CLAUDE.md "Team accounts"). */
async function logOffer(ctx: SellerMutationCtx, shopId: Id<"shops">, kind: ActivityKind, saleId: Id<"sales">, name: string) {
  await logShopActivity(ctx, { _id: shopId }, { actor: ctx.user, kind, targetId: saleId, targetLabel: name });
}

export const create = sellerMutation({
  permission: PERMISSION,
  args: saleInputFields,
  returns: v.id("sales"),
  handler: async (ctx, input) => {
    const shop = await requireOwnShop(ctx);
    await requireCan(ctx, shop, { kind: "feature", feature: "salesPromotions" });
    const existing = await shopSales(ctx, shop._id);
    if (existing.length >= SALES_MAX) fail("TOO_MANY_SALES");
    const now = Date.now();
    const fields = cleanSaleInput(shop, await shopProducts(ctx, shop._id), input, now);
    const saleId = await ctx.db.insert("sales", {
      shopId: shop._id,
      ...fields,
      paused: false,
      live: false,
      version: 1,
      updatedAt: now,
    });
    await writeLiveAndSchedule(ctx, (await ctx.db.get("sales", saleId))!, now);
    await logOffer(ctx, shop._id, "offer.created", saleId, fields.name);
    return saleId;
  },
});

/**
 * Edits a sale. `expectedVersion` is the version the editor opened: if
 * someone else saved in between (another phone, an admin pause), the
 * edit is refused with SALE_STALE instead of overwriting their change.
 */
export const update = sellerMutation({
  permission: PERMISSION,
  args: { saleId: v.id("sales"), expectedVersion: v.number(), ...saleInputFields },
  returns: v.null(),
  handler: async (ctx, { saleId, expectedVersion, ...input }) => {
    const { shop, sale } = await requireOwnSale(ctx, saleId);
    await requireCan(ctx, shop, { kind: "feature", feature: "salesPromotions" });
    if (sale.version !== expectedVersion) fail("SALE_STALE");
    const now = Date.now();
    // A sale that already started keeps its start when the seller leaves it.
    const keepStart = sale.startsAt <= now ? sale.startsAt : undefined;
    const fields = cleanSaleInput(shop, await shopProducts(ctx, shop._id), input, now, keepStart);
    await ctx.db.patch("sales", saleId, { ...fields, version: sale.version + 1, updatedAt: now });
    await writeLiveAndSchedule(ctx, (await ctx.db.get("sales", saleId))!, now);
    await logOffer(ctx, shop._id, "offer.updated", saleId, fields.name);
    return null;
  },
});

/**
 * Copies a sale, paused, so the seller reviews it before it runs. An
 * ended sale's copy starts now and lasts as long as the original did.
 */
export const duplicate = sellerMutation({
  permission: PERMISSION,
  args: { saleId: v.id("sales"), name: v.string() },
  returns: v.id("sales"),
  handler: async (ctx, { saleId, name }) => {
    const { shop, sale } = await requireOwnSale(ctx, saleId);
    await requireCan(ctx, shop, { kind: "feature", feature: "salesPromotions" });
    if ((await shopSales(ctx, shop._id)).length >= SALES_MAX) fail("TOO_MANY_SALES");
    if (saleNameProblem(name) !== null) fail("SALE_NAME_INVALID");
    const now = Date.now();
    const ended = sale.endsAt <= now;
    const startsAt = ended ? now : sale.startsAt;
    const endsAt = ended ? now + (sale.endsAt - sale.startsAt) : sale.endsAt;
    const copyId = await ctx.db.insert("sales", {
      shopId: shop._id,
      name: name.trim(),
      discount: sale.discount,
      target: sale.target,
      startsAt,
      endsAt,
      display: sale.display,
      paused: true,
      live: false,
      version: 1,
      updatedAt: now,
    });
    await writeLiveAndSchedule(ctx, (await ctx.db.get("sales", copyId))!, now);
    await logOffer(ctx, shop._id, "offer.created", copyId, name.trim());
    return copyId;
  },
});

export const pause = sellerMutation({
  permission: PERMISSION,
  args: { saleId: v.id("sales") },
  returns: v.null(),
  handler: async (ctx, { saleId }) => {
    const { sale } = await requireOwnSale(ctx, saleId);
    if (sale.paused) return null;
    const now = Date.now();
    await ctx.db.patch("sales", saleId, { paused: true, version: sale.version + 1, updatedAt: now });
    await writeLiveAndSchedule(ctx, (await ctx.db.get("sales", saleId))!, now);
    await logOffer(ctx, sale.shopId, "offer.paused", saleId, sale.name);
    return null;
  },
});

/**
 * Resumes a sale paused by the seller or by an admin (the seller was told
 * why; they can fix it and resume). Needs the plan feature.
 */
export const resume = sellerMutation({
  permission: PERMISSION,
  args: { saleId: v.id("sales") },
  returns: v.null(),
  handler: async (ctx, { saleId }) => {
    const { shop, sale } = await requireOwnSale(ctx, saleId);
    if (!sale.paused && sale.adminPause === undefined) return null;
    await requireCan(ctx, shop, { kind: "feature", feature: "salesPromotions" });
    const now = Date.now();
    await ctx.db.patch("sales", saleId, {
      paused: false,
      adminPause: undefined,
      version: sale.version + 1,
      updatedAt: now,
    });
    await writeLiveAndSchedule(ctx, (await ctx.db.get("sales", saleId))!, now);
    await logOffer(ctx, shop._id, "offer.resumed", saleId, sale.name);
    return null;
  },
});

export const remove = sellerMutation({
  permission: PERMISSION,
  args: { saleId: v.id("sales") },
  returns: v.null(),
  handler: async (ctx, { saleId }) => {
    const { sale } = await requireOwnSale(ctx, saleId);
    await deleteSale(ctx, sale);
    await logOffer(ctx, sale.shopId, "offer.deleted", saleId, sale.name);
    return null;
  },
});
