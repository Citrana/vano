// Test-only helpers shared by convex/*.test.ts. The two dots in the file
// name are deliberate: the Convex CLI skips files with more than one dot,
// so this is never pushed to a deployment.
import aggregateTest from "@convex-dev/aggregate/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { convexTest, type TestConvex } from "convex-test";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

export type T = TestConvex<typeof schema>;

const modules = import.meta.glob("../**/*.*s");

/** Components mounted in convex/convex.config.ts. */
const AGGREGATES = ["usersByCreation", "shopsByCreation", "productsByCreation", "clicksByDay"];

/** A fresh test deployment with the app's components registered. */
export function newTest(): T {
  const t = convexTest(schema, modules);
  for (const name of AGGREGATES) aggregateTest.register(t, name);
  rateLimiterTest.register(t);
  return t;
}

export async function insertUser(t: T, email = "seller@example.com"): Promise<Id<"users">> {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}

export function as(t: T, userId: Id<"users">) {
  return t.withIdentity({ subject: userId });
}

/**
 * Stores a fake file; defaults to a 200 KB JPEG. convex-test doesn't record
 * `contentType` (a real upload takes it from the Content-Type header), so
 * it's patched onto the `_storage` row here.
 */
export async function storeFile(
  t: T,
  { type = "image/jpeg", size = 200_000 }: { type?: string; size?: number } = {},
): Promise<Id<"_storage">> {
  return await t.run(async (ctx) => {
    const id = await ctx.storage.store(new Blob([new Uint8Array(size)], { type }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only system write
    await (ctx.db as any).patch("_storage", id, { contentType: type });
    return id;
  });
}

export function shopArgs(overrides: Partial<ShopArgs> = {}): ShopArgs {
  return {
    name: "Chez Amani",
    slug: "chez-amani",
    currency: "USD",
    language: "fr",
    categories: ["clothes", "shoes"],
    description: "Mode femme à Goma",
    whatsappNumber: "+243 812 345 678",
    city: "Goma",
    country: "CD",
    ...overrides,
  };
}

/** Arguments for `shops.update` (the directly editable settings). */
export function settingsArgs(overrides: Partial<ShopArgs> = {}) {
  const a = shopArgs(overrides);
  return {
    currency: a.currency,
    language: a.language,
    categories: a.categories,
    description: a.description,
    city: a.city,
    country: a.country,
    logoId: a.logoId,
  };
}

export type ShopArgs = {
  name: string;
  slug: string;
  currency: "USD" | "CDF" | "KES" | "EUR";
  language: "en" | "fr";
  categories: Array<"clothes" | "shoes" | "bags" | "underwear" | "accessories" | "other">;
  description?: string;
  whatsappNumber: string;
  city: string;
  country: string;
  logoId?: Id<"_storage">;
};

/** A user with a shop. */
export async function sellerWithShop(
  t: T,
  email = "seller@example.com",
  overrides: Partial<ShopArgs> = {},
) {
  const userId = await insertUser(t, email);
  const shopId = await as(t, userId).mutation(api.shops.create, shopArgs(overrides));
  return { userId, shopId };
}

export async function productArgs(
  t: T,
  overrides: Partial<{
    name: string;
    price: number;
    category: ShopArgs["categories"][number];
    description: string;
    sizes: string[];
    colors: string[];
    imageIds: Id<"_storage">[];
    soldOut: boolean;
    pieces: number;
    costPrice: number;
    condition: "new" | "thrift";
    audience: "women" | "men" | "kids";
    code: string;
  }> = {},
) {
  return {
    name: "Robe wax",
    price: 2500,
    category: "clothes" as const,
    description: "Robe en pagne",
    sizes: ["S", "M"],
    colors: ["Rouge"],
    imageIds: overrides.imageIds ?? [await storeFile(t)],
    soldOut: false,
    pieces: 10,
    costPrice: 1500,
    ...overrides,
  };
}

/** Creates the built-in roles and returns their ids. */
export async function builtInRoles(t: T) {
  return await t.run(async (ctx) => {
    const { ensureBuiltInRoles } = await import("./roles");
    return await ensureBuiltInRoles(ctx);
  });
}

export async function insertRole(
  t: T,
  name: string,
  permissions: string[],
): Promise<Id<"roles">> {
  return await t.run((ctx) => ctx.db.insert("roles", { name, permissions }));
}

/** A user with the given role (and status, default active). */
export async function insertUserWithRole(
  t: T,
  email: string,
  roleId: Id<"roles">,
  status: "active" | "suspended" = "active",
): Promise<Id<"users">> {
  return await t.run((ctx) => ctx.db.insert("users", { email, roleId, status }));
}

/** Puts the shop on a plan directly (e.g. Free after the trial). */
export async function setSubscription(
  t: T,
  shopId: Id<"shops">,
  state: {
    plan: "free" | "pro" | "business" | "enterprise";
    status: "trialing" | "active" | "expired" | "free";
    periodEnd?: number;
    /** The paid days inside the period (the upgrade credit counts only these). */
    paidStart?: number;
    paidEnd?: number;
    source?: "trial" | "payment" | "admin" | "system";
  },
): Promise<void> {
  await t.run(async (ctx) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_shopId", (q) => q.eq("shopId", shopId))
      .unique();
    if (!sub) throw new Error("shop has no subscription");
    await ctx.db.patch("subscriptions", sub._id, {
      plan: state.plan,
      status: state.status,
      periodEnd: state.periodEnd,
      paidStart: state.paidStart,
      paidEnd: state.paidEnd,
      ...(state.source ? { source: state.source } : {}),
    });
  });
}

/** Inserts `count` products straight into the database (oldest first). */
export async function insertProducts(
  t: T,
  shopId: Id<"shops">,
  count: number,
  photos = 1,
): Promise<Id<"products">[]> {
  const ids: Id<"products">[] = [];
  for (let i = 0; i < count; i++) {
    const imageIds: Id<"_storage">[] = [];
    for (let j = 0; j < photos; j++) imageIds.push(await storeFile(t));
    ids.push(
      await t.run((ctx) =>
        ctx.db.insert("products", {
          shopId,
          name: `Product ${i}`,
          price: 1000,
          category: "clothes",
          sizes: [],
          colors: [],
          imageIds,
          soldOut: false,
          updatedAt: 0,
        }),
      ),
    );
  }
  return ids;
}
