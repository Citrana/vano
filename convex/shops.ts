import { getAuthUserId } from "@convex-dev/auth/server";
import { isSupportedCountry, type CountryCode } from "libphonenumber-js";
import { v, type Infer } from "convex/values";
import { query } from "./_generated/server";
import { categoryValidator, languageValidator, LIMITS } from "./lib/catalog";
import { cleanShopName } from "./lib/changeRequests";
import { fail } from "./lib/errors";
import { urlOf } from "./lib/images";
import { currencyValidator } from "./lib/money";
import { allStepsDone, onboardingSteps } from "./lib/onboarding";
import { normalizeWhatsapp } from "./lib/phone";
import { onShopCreated } from "./lib/platformStats";
import {
  claimImages,
  deleteFilesNotIn,
  findShopByOwner,
  requireOwnShop,
  sellerMutation,
  sellerQuery,
} from "./lib/seller";
import { lookRow } from "./lib/looks/store";
import { slugHolder } from "./lib/shopChanges";
import { cleanShopInfo, socialsValidator } from "./lib/shopInfo";
import { slugProblem } from "./lib/slug";
import { startFree, startTrial } from "./lib/subscriptions";

/** Settings the seller edits directly, any time. */
const settingsInput = v.object({
  currency: currencyValidator,
  language: languageValidator,
  categories: v.array(categoryValidator),
  description: v.optional(v.string()),
  city: v.string(),
  country: v.string(),
  logoId: v.optional(v.id("_storage")),
  /** About and contact (lib/shopInfo.ts). */
  openingHours: v.optional(v.string()),
  deliveryAreas: v.optional(v.string()),
  socials: v.optional(socialsValidator),
});
type SettingsInput = Infer<typeof settingsInput>;

/**
 * Onboarding also sets the protected fields. After that they only change
 * through an approved request (`changeRequests.create`, CLAUDE.md
 * "Protected shop changes").
 */
const shopInput = settingsInput.extend({
  name: v.string(),
  slug: v.string(),
  /** Any format; normalized to E.164 using `country` as the default region. */
  whatsappNumber: v.string(),
});
type ShopInput = Infer<typeof shopInput>;

/** Validates and normalizes the settings; every key is present (undefined = cleared). */
function cleanSettings(input: SettingsInput): SettingsInput {
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

  const info = cleanShopInfo(input);
  if (!info.ok) fail(info.problem === "tooLong" ? "INFO_TOO_LONG" : "SOCIAL_INVALID");

  return {
    ...info.value,
    currency: input.currency,
    language: input.language,
    categories,
    description,
    city,
    country,
    logoId: input.logoId,
  };
}

/** Validates and normalizes the onboarding form; throws an error code on bad input. */
function cleanShopInput(input: ShopInput): ShopInput {
  const settings = cleanSettings(input);
  const name = cleanShopName(input.name);
  if (name === null) fail("NAME_INVALID");

  const slug = input.slug.trim();
  const problem = slugProblem(slug);
  if (problem === "reserved") fail("SLUG_RESERVED");
  if (problem !== null) fail("SLUG_INVALID");

  // cleanSettings checked the country is supported.
  const whatsappNumber = normalizeWhatsapp(input.whatsappNumber, settings.country as CountryCode);
  if (whatsappNumber === null) fail("PHONE_INVALID");

  return { ...settings, name, slug, whatsappNumber };
}

/**
 * Live availability check for a slug field (onboarding, change requests).
 * Your own slug, or one of your own old links, counts as ok; another
 * shop's old link stays taken while it redirects.
 */
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
    const holder = await slugHolder(ctx, slug);
    if (holder === null) return { ok: true as const };
    const userId = await getAuthUserId(ctx);
    const mine = userId === null ? null : await findShopByOwner(ctx, userId);
    return mine?._id === holder
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
    return {
      ...shop,
      logoUrl: await urlOf(ctx, shop.logoId),
      /** Published a look (the dashboard checklist's "look" step). */
      hasLook: (await lookRow(ctx, shop._id))?.published !== undefined,
    };
  },
});

/**
 * Opens the caller's shop. `startPlan: "business"` (the pricing page's
 * "Get Business") skips the Pro trial: the shop starts on Free and pays for
 * Business right away. The flag can only remove the trial, never add
 * anything, so it's safe to take from the client.
 */
export const create = sellerMutation({
  permission: "ownShop.manage",
  args: { ...shopInput.fields, startPlan: v.optional(v.literal("business")) },
  returns: v.id("shops"),
  handler: async (ctx, { startPlan, ...args }) => {
    if (await findShopByOwner(ctx, ctx.user._id)) fail("SHOP_EXISTS");
    const input = cleanShopInput(args);
    if ((await slugHolder(ctx, input.slug)) !== null) fail("SLUG_TAKEN");
    if (input.logoId) await claimImages(ctx, [input.logoId]);
    const shopId = await ctx.db.insert("shops", { ...input, ownerId: ctx.user._id });
    const shop = (await ctx.db.get("shops", shopId))!;
    await onShopCreated(ctx, shop);
    // New shops start the Pro trial, except "Get Business" (CLAUDE.md "Billing").
    if (startPlan === "business") await startFree(ctx, shop);
    else await startTrial(ctx, shop);
    return shopId;
  },
});

/**
 * Saves the directly editable settings. Name, link and WhatsApp number
 * aren't accepted here (change requests). A replaced or removed logo is
 * deleted from storage; a category still used by a product can't be
 * removed; the currency is locked once the shop has products (their
 * prices are in it).
 */
export const update = sellerMutation({
  permission: "ownShop.manage",
  args: settingsInput.fields,
  returns: v.null(),
  handler: async (ctx, args) => {
    const shop = await requireOwnShop(ctx);
    const input = cleanSettings(args);

    if (input.currency !== shop.currency) {
      const anyProduct = await ctx.db
        .query("products")
        .withIndex("by_shopId", (q) => q.eq("shopId", shop._id))
        .first();
      if (anyProduct) fail("CURRENCY_LOCKED");
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

    // A patch: only these keys change (undefined clears an optional one),
    // so protected fields, status and onboarding progress are untouched.
    await ctx.db.patch("shops", shop._id, input);
    return null;
  },
});

/**
 * Dashboard checklist: the seller shared, copied or opened their link.
 * Only the first time is recorded.
 */
export const markLinkShared = sellerMutation({
  permission: "ownShop.manage",
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const shop = await requireOwnShop(ctx);
    if (shop.onboarding?.linkSharedAt !== undefined) return null;
    await ctx.db.patch("shops", shop._id, {
      onboarding: { ...shop.onboarding, linkSharedAt: Date.now() },
    });
    return null;
  },
});

/** Hides the dashboard checklist for good, once every step is done. */
export const hideChecklist = sellerMutation({
  permission: "ownShop.manage",
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const shop = await requireOwnShop(ctx);
    const firstProduct = await ctx.db
      .query("products")
      .withIndex("by_shopId", (q) => q.eq("shopId", shop._id))
      .first();
    const steps = onboardingSteps({
      productCount: firstProduct ? 1 : 0,
      hasLook: (await lookRow(ctx, shop._id))?.published !== undefined,
      linkSharedAt: shop.onboarding?.linkSharedAt,
    });
    if (!allStepsDone(steps)) fail("ONBOARDING_INCOMPLETE");
    if (shop.onboarding?.checklistHiddenAt !== undefined) return null;
    await ctx.db.patch("shops", shop._id, {
      onboarding: { ...shop.onboarding, checklistHiddenAt: Date.now() },
    });
    return null;
  },
});
