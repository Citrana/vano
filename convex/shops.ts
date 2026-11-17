import { getAuthUserId } from "@convex-dev/auth/server";
import { isSupportedCountry } from "libphonenumber-js";
import { v, type Infer } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { categoryValidator, languageValidator, LIMITS } from "./lib/catalog";
import { fail } from "./lib/errors";
import { urlOf } from "./lib/images";
import { currencyValidator } from "./lib/money";
import { normalizeWhatsapp } from "./lib/phone";
import {
  claimImages,
  deleteFilesNotIn,
  findShopByOwner,
  requireOwnShop,
  sellerMutation,
  sellerQuery,
} from "./lib/seller";
import { slugProblem } from "./lib/slug";

const shopInput = v.object({
  name: v.string(),
  slug: v.string(),
  currency: currencyValidator,
  language: languageValidator,
  categories: v.array(categoryValidator),
  description: v.optional(v.string()),
  /** Any format; normalized to E.164 using `country` as the default region. */
  whatsappNumber: v.string(),
  city: v.string(),
  country: v.string(),
  logoId: v.optional(v.id("_storage")),
});
type ShopInput = Infer<typeof shopInput>;

/** Validates and normalizes the form; throws an error code on bad input. */
function cleanShopInput(input: ShopInput): ShopInput {
  const name = input.name.trim();
  if (name.length < LIMITS.shopNameMin || name.length > LIMITS.shopNameMax) {
    fail("NAME_INVALID");
  }
  const slug = input.slug.trim();
  const problem = slugProblem(slug);
  if (problem === "reserved") fail("SLUG_RESERVED");
  if (problem !== null) fail("SLUG_INVALID");

  const categories = [...new Set(input.categories)];
  if (categories.length === 0) fail("CATEGORIES_REQUIRED");

  const description = input.description?.trim() || undefined;
  if (description && description.length > LIMITS.shopDescriptionMax) {
    fail("DESCRIPTION_TOO_LONG");
  }
  const city = input.city.trim();
  if (city.length === 0 || city.length > LIMITS.cityMax) fail("CITY_INVALID");

  const country = input.country.trim().toUpperCase();
  if (!isSupportedCountry(country)) fail("COUNTRY_INVALID");

  const whatsappNumber = normalizeWhatsapp(input.whatsappNumber, country);
  if (whatsappNumber === null) fail("PHONE_INVALID");

  return {
    name,
    slug,
    currency: input.currency,
    language: input.language,
    categories,
    description,
    whatsappNumber,
    city,
    country,
    logoId: input.logoId,
  };
}

async function slugOwner(ctx: QueryCtx, slug: string): Promise<Id<"shops"> | null> {
  const shop = await ctx.db
    .query("shops")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  return shop?._id ?? null;
}

/** Live availability check for the slug field. Your own slug counts as ok. */
export const checkSlug = query({
  args: { slug: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({
      ok: v.literal(false),
      problem: v.union(
        v.literal("length"),
        v.literal("format"),
        v.literal("reserved"),
        v.literal("taken"),
      ),
    }),
  ),
  handler: async (ctx, { slug }) => {
    const problem = slugProblem(slug);
    if (problem !== null) return { ok: false as const, problem };
    const ownerShopId = await slugOwner(ctx, slug);
    if (ownerShopId === null) return { ok: true as const };
    const userId = await getAuthUserId(ctx);
    const mine = userId === null ? null : await findShopByOwner(ctx, userId);
    return mine?._id === ownerShopId
      ? { ok: true as const }
      : { ok: false as const, problem: "taken" as const };
  },
});

/** The caller's shop (with logo URL), or null before onboarding. */
export const myShop = sellerQuery({
  permission: "ownShop.manage",
  args: {},
  handler: async (ctx) => {
    const shop = await findShopByOwner(ctx, ctx.user._id);
    if (!shop) return null;
    return { ...shop, logoUrl: await urlOf(ctx, shop.logoId) };
  },
});

export const create = sellerMutation({
  permission: "ownShop.manage",
  args: shopInput.fields,
  returns: v.id("shops"),
  handler: async (ctx, args) => {
    if (await findShopByOwner(ctx, ctx.user._id)) fail("SHOP_EXISTS");
    const input = cleanShopInput(args);
    if ((await slugOwner(ctx, input.slug)) !== null) fail("SLUG_TAKEN");
    if (input.logoId) await claimImages(ctx, [input.logoId]);
    return await ctx.db.insert("shops", { ...input, ownerId: ctx.user._id });
  },
});

/**
 * Saves shop settings. A replaced or removed logo is deleted from storage;
 * a category still used by a product can't be removed.
 */
export const update = sellerMutation({
  permission: "ownShop.manage",
  args: shopInput.fields,
  returns: v.null(),
  handler: async (ctx, args) => {
    const shop = await requireOwnShop(ctx);
    const input = cleanShopInput(args);

    if (input.slug !== shop.slug) {
      const owner = await slugOwner(ctx, input.slug);
      if (owner !== null && owner !== shop._id) fail("SLUG_TAKEN");
    }

    const removed = shop.categories.filter((c) => !input.categories.includes(c));
    for (const category of removed) {
      const used = await ctx.db
        .query("products")
        .withIndex("by_shopId_and_category", (q) =>
          q.eq("shopId", shop._id).eq("category", category),
        )
        .first();
      if (used) fail("CATEGORY_IN_USE");
    }

    if (input.logoId && input.logoId !== shop.logoId) {
      await claimImages(ctx, [input.logoId]);
    }
    await deleteFilesNotIn(
      ctx,
      shop.logoId ? [shop.logoId] : [],
      input.logoId ? [input.logoId] : [],
    );

    // Fields the seller doesn't control are carried over, or `replace` would drop them.
    await ctx.db.replace("shops", shop._id, {
      ...input,
      ownerId: shop.ownerId,
      status: shop.status,
    });
    return null;
  },
});
