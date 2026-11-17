import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import type { DataModel, Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { addDays, dayStartMs, isDay } from "./days";

/**
 * Platform-wide counters for the admin dashboard (CLAUDE.md "Stats"), kept
 * by the `@convex-dev/aggregate` component. Every insert / delete of users,
 * shops and products, and every WhatsApp click, calls a helper below in
 * the same mutation as the write.
 *
 * The helpers use the idempotent methods (`insertIfDoesNotExist`, …) so
 * the live path and the `migrations:rbacV1` backfill can overlap without
 * counting anything twice.
 *
 * Trade-off: keys on `_creationTime` / today's day mean these writes are
 * serialized. That's fine at Vano's scale.
 */

const usersByCreation = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "users";
}>(components.usersByCreation, { sortKey: (d) => d._creationTime });

const shopsByCreation = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "shops";
}>(components.shopsByCreation, { sortKey: (d) => d._creationTime });

const productsByCreation = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "products";
}>(components.productsByCreation, { sortKey: (d) => d._creationTime });

const clicksByDay = new TableAggregate<{
  Key: string;
  DataModel: DataModel;
  TableName: "shopDailyStats";
}>(components.clicksByDay, { sortKey: (d) => d.day, sumValue: (d) => d.whatsappClicks });

export async function onUserCreated(ctx: MutationCtx, user: Doc<"users">) {
  await usersByCreation.insertIfDoesNotExist(ctx, user);
}

export async function onShopCreated(ctx: MutationCtx, shop: Doc<"shops">) {
  await shopsByCreation.insertIfDoesNotExist(ctx, shop);
}

export async function onShopDeleted(ctx: MutationCtx, shop: Doc<"shops">) {
  await shopsByCreation.deleteIfExists(ctx, shop);
}

export async function onProductCreated(ctx: MutationCtx, product: Doc<"products">) {
  await productsByCreation.insertIfDoesNotExist(ctx, product);
}

export async function onProductDeleted(ctx: MutationCtx, product: Doc<"products">) {
  await productsByCreation.deleteIfExists(ctx, product);
}

/** A shop's daily stats row was inserted (`before` null) or updated. */
export async function onShopDayStatsWritten(
  ctx: MutationCtx,
  before: Doc<"shopDailyStats"> | null,
  after: Doc<"shopDailyStats">,
) {
  if (before === null) {
    await clicksByDay.insertIfDoesNotExist(ctx, after);
  } else if (before.whatsappClicks !== after.whatsappClicks) {
    await clicksByDay.replaceOrInsert(ctx, before, after);
  }
}

export async function onShopDayStatsDeleted(ctx: MutationCtx, row: Doc<"shopDailyStats">) {
  await clicksByDay.deleteIfExists(ctx, row);
}

export type PlatformStats = {
  totals: { users: number; shops: number; products: number; whatsappClicks: number };
  last7: { signups: number; shops: number };
  last30: { signups: number; shops: number };
};

/**
 * Totals plus new sign-ups / shops over the last 7 and 30 days (today
 * included). `today` ("YYYY-MM-DD", UTC) comes from the caller because
 * queries must not read the clock; an invalid day gives zero windows.
 */
export async function readPlatformStats(
  ctx: QueryCtx | MutationCtx,
  today: string,
): Promise<PlatformStats> {
  const totals = await readPlatformTotals(ctx);
  const since = async (days: number) => {
    if (!isDay(today)) return { signups: 0, shops: 0 };
    const bounds = { lower: { key: dayStartMs(addDays(today, 1 - days)), inclusive: true } };
    const [signups, newShops] = await Promise.all([
      usersByCreation.count(ctx, { bounds }),
      shopsByCreation.count(ctx, { bounds }),
    ]);
    return { signups, shops: newShops };
  };
  return {
    totals,
    last7: await since(7),
    last30: await since(30),
  };
}

/** All-time totals only (no clock needed). */
export async function readPlatformTotals(
  ctx: QueryCtx | MutationCtx,
): Promise<PlatformStats["totals"]> {
  const [users, shops, products, whatsappClicks] = await Promise.all([
    usersByCreation.count(ctx),
    shopsByCreation.count(ctx),
    productsByCreation.count(ctx),
    clicksByDay.sum(ctx),
  ]);
  return { users, shops, products, whatsappClicks };
}

/** Backfill helpers for `migrations:rbacV1` (same idempotent writes). */
export const backfill = {
  user: onUserCreated,
  shop: onShopCreated,
  product: onProductCreated,
  shopDayStats: (ctx: MutationCtx, row: Doc<"shopDailyStats">) =>
    clicksByDay.insertIfDoesNotExist(ctx, row),
};
