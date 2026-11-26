import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { hasPermission } from "./lib/access";
import { isDay } from "./lib/days";
import { normalizeCode, codeTextProblem } from "./lib/discountCodes/code";
import { evaluateCode } from "./lib/discountCodes/active";
import { codeByText } from "./lib/discountCodes/store";
import type { CodeResult } from "./lib/discountCodes/validators";
import { hasFeature, requireCan } from "./lib/entitlements";
import { fail } from "./lib/errors";
import { urlOf } from "./lib/images";
import { applyPieces, applyStock, notifySoldOut, piecesTracked, recordProductEvent } from "./lib/productStock";
import { takePieces } from "./lib/stock";
import { saleForProduct } from "./lib/sales/store";
import { recordTotals, suggestedPrice, sumRecords } from "./lib/salesRecords/pricing";
import {
  cleanCustomerPhone,
  cleanOption,
  customerNameProblem,
  finalPriceProblem,
  HISTORY_MAX,
  LIST_MAX,
  quantityProblem,
  soldAtProblem,
} from "./lib/salesRecords/rules";
import { recordInputFields, recordStatusValidator, saleSourceValidator } from "./lib/salesRecords/validators";
import { sortOrderValidator } from "./lib/listOrder";
import { logShopActivity } from "./lib/shopActivity";
import { memberLabel } from "./lib/team";
import {
  requireOwnProduct,
  requireOwnShop,
  sellerMutation,
  sellerQuery,
  type SellerMutationCtx,
  type SellerQueryCtx,
} from "./lib/seller";
import { localDay, shopTimeZone, timeZoneProblem } from "./lib/timeZone";

/**
 * Recorded sales (CLAUDE.md "Sales tracking"): a seller marks a product
 * as sold; the row keeps a snapshot so reports stay right whatever happens
 * to the product later. Business only (`salesReports`): without it the
 * page is locked and every write refused, but nothing is ever deleted.
 * Not to be confused with `sales.ts` (promotions, shown as "Offers").
 */

const PERMISSION = "ownSales.manage" as const;
const FEATURE = { kind: "feature", feature: "salesReports" } as const;

/** Customer name / phone are personal data: owner and permitted team only. */
function canSeeCustomers(ctx: SellerQueryCtx): boolean {
  return hasPermission(ctx.access, "ownCustomers.view");
}

/** One of the caller's recorded sales; another shop's is NOT_FOUND. */
async function requireOwnRecord(
  ctx: SellerQueryCtx,
  recordId: Id<"salesRecords">,
): Promise<{ shop: Doc<"shops">; record: Doc<"salesRecords"> }> {
  const shop = await requireOwnShop(ctx);
  const record = await ctx.db.get("salesRecords", recordId);
  if (!record || record.shopId !== shop._id) fail("NOT_FOUND");
  return { shop, record };
}

/** The record as the seller UI shows it (customer only with permission). */
async function recordView(
  ctx: QueryCtx,
  record: Doc<"salesRecords">,
  withCustomer: boolean,
  urls: Map<string, string | null> = new Map(),
  labels: Map<string, string> = new Map(),
) {
  let photoUrl: string | null = null;
  // Who marked it (CLAUDE.md "Team accounts"): their name, else their email.
  if (!labels.has(record.createdBy)) labels.set(record.createdBy, memberLabel(await ctx.db.get("users", record.createdBy)));
  if (record.photoId) {
    if (!urls.has(record.photoId)) urls.set(record.photoId, await urlOf(ctx, record.photoId));
    photoUrl = urls.get(record.photoId) ?? null;
  }
  return {
    _id: record._id,
    productId: record.productId,
    productName: record.productName,
    photoUrl,
    category: record.category,
    size: record.size ?? null,
    color: record.color ?? null,
    normalUnitPrice: record.normalUnitPrice,
    finalUnitPrice: record.finalUnitPrice,
    quantity: record.quantity,
    total: record.total,
    discount: record.discount,
    offer: record.offer ?? null,
    source: record.source,
    customerName: withCustomer ? (record.customerName ?? null) : null,
    customerPhone: withCustomer ? (record.customerPhone ?? null) : null,
    soldAt: record.soldAt,
    day: record.day,
    markedSoldOut: record.markedSoldOut,
    status: record.status,
    reversedAt: record.reversedAt ?? null,
    version: record.version,
    recordedBy: labels.get(record.createdBy) ?? "—",
  };
}

/** What a code gives on this product right now (the seller's own code; uses aren't counted). */
async function codeFor(
  ctx: QueryCtx,
  shop: Doc<"shops">,
  product: Doc<"products">,
  sale: { price: number } | null,
  text: string | undefined,
  now: number,
): Promise<CodeResult | null> {
  if (text === undefined || text.trim() === "") return null;
  const normalized = normalizeCode(text);
  const entitled = codeTextProblem(normalized) === null && (await hasFeature(ctx, shop, "discountCodes"));
  const code = entitled ? await codeByText(ctx, shop._id, normalized) : null;
  // The customer's Order tap already counted the use: a used-up code still
  // describes the price they got.
  return evaluateCode({ code, product, sale, currency: shop.currency, now, alreadyUsed: true });
}

/**
 * What the "Mark as sold" dialog shows for a product: the snapshot, the
 * price to prefill (running sale or a valid code, best for the customer)
 * and the sold-out default. `now` comes from the browser (queries never
 * read the clock); `record` checks everything again.
 */
export const quote = sellerQuery({
  permission: PERMISSION,
  args: { productId: v.id("products"), code: v.optional(v.string()), now: v.number() },
  handler: async (ctx, { productId, code, now }) => {
    const { shop, product } = await requireOwnProduct(ctx, productId);
    if (!(await hasFeature(ctx, shop, "salesReports"))) return { locked: true as const };
    const sale = await saleForProduct(ctx, shop, product);
    const codeResult = await codeFor(ctx, shop, product, sale, code, now);
    const suggested = suggestedPrice({ normalPrice: product.price, sale, code: codeResult });
    const tracked = product.pieces !== undefined && (await hasFeature(ctx, shop, "stockManagement"));
    return {
      locked: false as const,
      product: {
        _id: product._id,
        name: product.name,
        coverUrl: await urlOf(ctx, product.imageIds[0]),
        sizes: product.sizes,
        colors: product.colors,
        price: product.price,
        soldOut: product.soldOut,
      },
      currency: shop.currency,
      country: shop.country,
      timeZone: shopTimeZone(shop),
      hasTimeZone: shop.timeZone !== undefined,
      suggestedPrice: suggested.price,
      offer: suggested.offer,
      codeStatus: codeResult?.status ?? null,
      /** Pieces left when the count is tracked (a sale takes its quantity), else null. */
      pieces: tracked ? (product.pieces ?? null) : null,
      canSeeCustomers: canSeeCustomers(ctx),
    };
  },
});

type CleanEdit = { finalUnitPrice: number; quantity: number; soldAt: number };

function checkEdit(input: CleanEdit, now: number): void {
  if (quantityProblem(input.quantity) !== null) fail("SALES_RECORD_QUANTITY");
  if (finalPriceProblem(input.finalUnitPrice) !== null) fail("SALES_RECORD_PRICE");
  if (soldAtProblem(input.soldAt, now) !== null) fail("SALES_RECORD_DATE");
}

/** The shop's zone, saving the browser's on the first sale of a shop without one. */
async function zoneFor(ctx: SellerMutationCtx, shop: Doc<"shops">, browserZone: string | undefined): Promise<string> {
  if (shop.timeZone === undefined && browserZone !== undefined && timeZoneProblem(browserZone) === null) {
    await ctx.db.patch("shops", shop._id, { timeZone: browserZone });
    return browserZone;
  }
  return shopTimeZone(shop);
}

/**
 * Records a sale ("Confirm sale"). Everything is checked again here: the
 * options, the price, the date, the customer, and the offer is recomputed.
 * A product whose pieces are tracked loses the quantity sold (never more
 * than it has): "Few left" at 3 or fewer, "Sold out" at 0, and taking the
 * last piece notifies the seller. Untracked products don't change.
 */
export const record = sellerMutation({
  permission: PERMISSION,
  args: recordInputFields,
  returns: v.id("salesRecords"),
  handler: async (ctx, args) => {
    const { shop, product } = await requireOwnProduct(ctx, args.productId);
    await requireCan(ctx, shop, FEATURE);
    const now = Date.now();
    checkEdit(args, now);
    const size = cleanOption(args.size, product.sizes);
    const color = cleanOption(args.color, product.colors);
    if (!size.ok || !color.ok) fail("SALES_RECORD_OPTION");
    if (customerNameProblem(args.customerName) !== null) fail("SALES_RECORD_CUSTOMER");
    const customerPhone = cleanCustomerPhone(args.customerPhone, shop.country);
    if (customerPhone === null) fail("SALES_RECORD_CUSTOMER");
    if (args.timeZone !== undefined && timeZoneProblem(args.timeZone) !== null) fail("TIME_ZONE_INVALID");

    const tracked = await piecesTracked(ctx, shop, product);
    const left = tracked ? takePieces(product.pieces ?? 0, args.quantity) : null;
    if (left === "notEnough") fail("SALES_RECORD_STOCK");
    const zone = await zoneFor(ctx, shop, args.timeZone);
    const sale = await saleForProduct(ctx, shop, product);
    const codeResult = await codeFor(ctx, shop, product, sale, args.code, now);
    const { offer } = suggestedPrice({ normalPrice: product.price, sale, code: codeResult });
    const totals = recordTotals({
      normalUnitPrice: product.price,
      finalUnitPrice: args.finalUnitPrice,
      quantity: args.quantity,
    });
    const recordId = await ctx.db.insert("salesRecords", {
      shopId: shop._id,
      productId: product._id,
      productName: product.name,
      photoId: product.imageIds[0],
      category: product.category,
      size: size.value,
      color: color.value,
      currency: shop.currency,
      normalUnitPrice: product.price,
      finalUnitPrice: args.finalUnitPrice,
      quantity: args.quantity,
      ...totals,
      // Private snapshot for profit later; never returned by the lists.
      unitCost: product.costPrice,
      offer: offer ?? undefined,
      source: args.source,
      customerName: args.customerName?.trim() || undefined,
      customerPhone,
      soldAt: args.soldAt,
      day: localDay(args.soldAt, zone),
      markedSoldOut: false,
      status: "recorded",
      createdBy: ctx.user._id,
      updatedAt: now,
      version: 1,
    });
    const by = { byUserId: ctx.user._id, salesRecordId: recordId };
    await recordProductEvent(ctx, product, "sold", { at: now, ...by });
    if (left !== null) {
      const soldOut = await applyPieces(ctx, product, left, now, by);
      await ctx.db.patch("salesRecords", recordId, { piecesTaken: args.quantity, markedSoldOut: soldOut });
      if (soldOut) await notifySoldOut(ctx, shop, product, now);
    }
    await logShopActivity(ctx, shop, {
      actor: ctx.user,
      kind: "sale.recorded",
      targetId: recordId,
      targetLabel: product.name,
    });
    return recordId;
  },
});

/** Changes a sale's price, quantity or date (`expectedVersion` guards against a stale edit). */
export const update = sellerMutation({
  permission: PERMISSION,
  args: {
    recordId: v.id("salesRecords"),
    expectedVersion: v.number(),
    finalUnitPrice: v.number(),
    quantity: v.number(),
    soldAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { recordId, expectedVersion, ...input }) => {
    const { shop, record } = await requireOwnRecord(ctx, recordId);
    await requireCan(ctx, shop, FEATURE);
    if (record.status === "reversed") fail("SALES_RECORD_REVERSED");
    if (record.version !== expectedVersion) fail("SALES_RECORD_STALE");
    const now = Date.now();
    checkEdit(input, now);
    const stock = await editStock(ctx, shop, record, input.quantity, now);
    const totals = recordTotals({ normalUnitPrice: record.normalUnitPrice, ...input });
    await ctx.db.patch("salesRecords", recordId, {
      ...input,
      ...totals,
      ...stock,
      day: localDay(input.soldAt, shopTimeZone(shop)),
      updatedAt: now,
      version: record.version + 1,
    });
    await recordProductEvent(ctx, recordSubject(record), "saleEdited", {
      at: now,
      byUserId: ctx.user._id,
      salesRecordId: recordId,
    });
    await logShopActivity(ctx, shop, {
      actor: ctx.user,
      kind: "sale.edited",
      targetId: recordId,
      targetLabel: record.productName,
    });
    return null;
  },
});

/** The record's product when it still exists in its shop, else null. */
async function recordProduct(ctx: SellerMutationCtx, record: Doc<"salesRecords">) {
  const product = await ctx.db.get("products", record.productId);
  return product && product.shopId === record.shopId ? product : null;
}

/**
 * A quantity change on a sale that took pieces: the difference is taken
 * from (or given back to) the product's count, never more than it has.
 * Nothing changes when the count isn't tracked anymore.
 */
async function editStock(
  ctx: SellerMutationCtx,
  shop: Doc<"shops">,
  record: Doc<"salesRecords">,
  quantity: number,
  now: number,
): Promise<{ piecesTaken?: number; markedSoldOut?: boolean }> {
  if (record.piecesTaken === undefined || quantity === record.piecesTaken) return {};
  const product = await recordProduct(ctx, record);
  if (!product || !(await piecesTracked(ctx, shop, product))) return {};
  const left = takePieces(product.pieces ?? 0, quantity - record.piecesTaken);
  if (left === "notEnough") fail("SALES_RECORD_STOCK");
  const soldOut = await applyPieces(ctx, product, left, now, { byUserId: ctx.user._id, salesRecordId: record._id });
  if (soldOut) await notifySoldOut(ctx, shop, product, now);
  return { piecesTaken: quantity, ...(soldOut ? { markedSoldOut: true } : {}) };
}

/** The product a record is about, for its history (it may be deleted). */
function recordSubject(record: Doc<"salesRecords">) {
  return { _id: record.productId, shopId: record.shopId, name: record.productName };
}

/**
 * Reverses a sale: kept in the list (tagged), excluded from every total.
 * The pieces it took go back to a tracked product (no longer sold out
 * once it has some again); an untracked product this sale marked sold out
 * is put back on sale. "Back in stock" follows its usual rule.
 */
export const reverse = sellerMutation({
  permission: PERMISSION,
  args: { recordId: v.id("salesRecords"), expectedVersion: v.number() },
  returns: v.null(),
  handler: async (ctx, { recordId, expectedVersion }) => {
    const { shop, record } = await requireOwnRecord(ctx, recordId);
    await requireCan(ctx, shop, FEATURE);
    if (record.status === "reversed") fail("SALES_RECORD_REVERSED");
    if (record.version !== expectedVersion) fail("SALES_RECORD_STALE");
    const now = Date.now();
    await ctx.db.patch("salesRecords", recordId, {
      status: "reversed",
      reversedAt: now,
      updatedAt: now,
      version: record.version + 1,
    });
    const by = { byUserId: ctx.user._id, salesRecordId: recordId };
    await recordProductEvent(ctx, recordSubject(record), "saleReversed", { at: now, ...by });
    await logShopActivity(ctx, shop, {
      actor: ctx.user,
      kind: "sale.reversed",
      targetId: recordId,
      targetLabel: record.productName,
    });
    const product = await recordProduct(ctx, record);
    if (!product) return null;
    if (record.piecesTaken !== undefined && (await piecesTracked(ctx, shop, product))) {
      await applyPieces(ctx, product, (product.pieces ?? 0) + record.piecesTaken, now, by);
    } else if (record.markedSoldOut && product.soldOut && !(await piecesTracked(ctx, shop, product))) {
      await applyStock(ctx, product, false, now, by);
    }
    return null;
  },
});

/**
 * The Sales page (the shared list, CLAUDE.md "UI"): the latest sales, or
 * those between two days of the shop's zone (either bound alone works),
 * newest first unless `order` says otherwise; filtered by source, status,
 * product and search (product name, and the customer name when allowed).
 * Totals cover the filtered list (reversed sales listed, never counted).
 * At most LIST_MAX rows are read (`truncated` beyond). Locked without the
 * plan feature: only how many sales are kept.
 */
export const listMine = sellerQuery({
  // The Reports CSV reuses this list (CLAUDE.md "Sales tracking").
  permission: [PERMISSION, "ownReports.view"],
  args: {
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    source: v.optional(saleSourceValidator),
    status: v.optional(recordStatusValidator),
    productId: v.optional(v.string()),
    search: v.optional(v.string()),
    order: v.optional(sortOrderValidator),
  },
  handler: async (ctx, args) => {
    const shop = await requireOwnShop(ctx);
    if (!(await hasFeature(ctx, shop, "salesReports"))) {
      const kept = await ctx.db
        .query("salesRecords")
        .withIndex("by_shopId_and_soldAt", (q) => q.eq("shopId", shop._id))
        .take(LIST_MAX);
      return { locked: true as const, kept: kept.length };
    }
    const { from, to } = args;
    if ((from !== undefined && !isDay(from)) || (to !== undefined && !isDay(to)) || (from && to && from > to)) {
      fail("SALES_RECORD_INVALID");
    }
    const loaded =
      from === undefined && to === undefined
        ? await ctx.db
            .query("salesRecords")
            .withIndex("by_shopId_and_soldAt", (q) => q.eq("shopId", shop._id))
            .order("desc")
            .take(LIST_MAX + 1)
        : await ctx.db
            .query("salesRecords")
            .withIndex("by_shopId_and_day", (q) => {
              const shopRange = q.eq("shopId", shop._id);
              if (from !== undefined && to !== undefined) return shopRange.gte("day", from).lte("day", to);
              if (from !== undefined) return shopRange.gte("day", from);
              return shopRange.lte("day", to!);
            })
            .order("desc")
            .take(LIST_MAX + 1);
    const truncated = loaded.length > LIST_MAX;
    const direction = args.order === "asc" ? 1 : -1;
    const records = loaded.slice(0, LIST_MAX).sort((a, b) => direction * (a.soldAt - b.soldAt));

    const withCustomer = canSeeCustomers(ctx);
    const search = args.search?.trim().toLowerCase() ?? "";
    const shown = records.filter(
      (r) =>
        (args.source === undefined || r.source === args.source) &&
        (args.status === undefined || r.status === args.status) &&
        (args.productId === undefined || r.productId === args.productId) &&
        (search === "" ||
          r.productName.toLowerCase().includes(search) ||
          (withCustomer && (r.customerName ?? "").toLowerCase().includes(search))),
    );
    // Products of the loaded sales (deleted ones included), for the filter.
    const products = new Map<string, string>();
    for (const r of records) if (!products.has(r.productId)) products.set(r.productId, r.productName);

    const urls = new Map<string, string | null>();
    const labels = new Map<string, string>();
    return {
      locked: false as const,
      rows: await Promise.all(shown.map((r) => recordView(ctx, r, withCustomer, urls, labels))),
      totals: sumRecords(shown),
      products: [...products].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      truncated,
      currency: shop.currency,
      timeZone: shopTimeZone(shop),
      canSeeCustomers: withCustomer,
    };
  },
});

/** One sale for the details drawer, or null (bad id / another shop's / locked). */
export const get = sellerQuery({
  permission: PERMISSION,
  args: { recordId: v.string() },
  handler: async (ctx, { recordId }) => {
    const shop = await requireOwnShop(ctx);
    const id = ctx.db.normalizeId("salesRecords", recordId);
    const record = id ? await ctx.db.get("salesRecords", id) : null;
    if (!record || record.shopId !== shop._id) return null;
    if (!(await hasFeature(ctx, shop, "salesReports"))) return null;
    const product = await ctx.db.get("products", record.productId);
    return {
      ...(await recordView(ctx, record, canSeeCustomers(ctx))),
      currency: record.currency,
      timeZone: shopTimeZone(shop),
      productExists: product !== null && product.shopId === shop._id,
      /** Pieces a reversal gives back to the product's stock, or null. */
      piecesTaken: record.piecesTaken ?? null,
    };
  },
});

/** A product's last sales and history rows (the product page card). */
export const productHistory = sellerQuery({
  permission: PERMISSION,
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    const { shop } = await requireOwnProduct(ctx, productId);
    if (!(await hasFeature(ctx, shop, "salesReports"))) return { locked: true as const };
    const records = await ctx.db
      .query("salesRecords")
      .withIndex("by_productId", (q) => q.eq("productId", productId))
      .order("desc")
      .take(HISTORY_MAX);
    const events = await ctx.db
      .query("productEvents")
      .withIndex("by_productId_and_at", (q) => q.eq("productId", productId))
      .order("desc")
      .take(HISTORY_MAX);
    const withCustomer = canSeeCustomers(ctx);
    const labels = new Map<string, string>();
    const sales = [];
    for (const r of records) sales.push(await recordView(ctx, r, withCustomer, new Map(), labels));
    const eventRows = [];
    for (const e of events) {
      if (e.byUserId && !labels.has(e.byUserId)) labels.set(e.byUserId, memberLabel(await ctx.db.get("users", e.byUserId)));
      eventRows.push({
        _id: e._id,
        kind: e.kind,
        at: e.at,
        salesRecordId: e.salesRecordId ?? null,
        /** Who did it (CLAUDE.md "Team accounts"); null for automatic changes. */
        by: e.byUserId ? (labels.get(e.byUserId) ?? null) : null,
      });
    }
    return {
      locked: false as const,
      currency: shop.currency,
      timeZone: shopTimeZone(shop),
      sales,
      events: eventRows,
    };
  },
});
