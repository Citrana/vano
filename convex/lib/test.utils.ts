// Test-only helpers shared by convex/*.test.ts. The two dots in the file
// name are deliberate: the Convex CLI skips files with more than one dot,
// so this is never pushed to a deployment.
import type { TestConvex } from "convex-test";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type schema from "../schema";

export type T = TestConvex<typeof schema>;

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
