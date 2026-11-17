import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { utcDay } from "../lib/days";
import {
  as,
  builtInRoles,
  insertRole,
  insertUserWithRole,
  newTest,
  productArgs,
  sellerWithShop,
  type T,
} from "../lib/test.utils";

const today = utcDay(Date.now());
const overview = (t: T, userId: Parameters<typeof as>[1], day = today) =>
  as(t, userId).query(api.admin.dashboard.overview, { today: day });

async function seededSuperAdmin(t: T) {
  await t.action(internal.seed.superAdmin, { email: "boss@example.com", password: "password1" });
  return await t.run(async (ctx) =>
    (await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", "boss@example.com"))
      .unique())!._id,
  );
}

describe("admin.dashboard.overview", () => {
  test("a super admin sees platform totals and growth", async () => {
    const t = newTest();
    const admin = await seededSuperAdmin(t);
    const { userId } = await sellerWithShop(t);
    const me = as(t, userId);
    const p1 = await me.mutation(api.products.create, await productArgs(t));
    const p2 = await me.mutation(api.products.create, await productArgs(t));
    await me.mutation(api.products.remove, { productId: p2 });
    await t.mutation(api.stats.recordWhatsappClick, { productId: p1 });
    await t.mutation(api.stats.recordWhatsappClick, { productId: p1 });

    // Users: only the seeded admin went through sign-up; the test seller was
    // inserted directly (never counted), like data from before the counters.
    expect(await overview(t, admin)).toEqual({
      totals: { users: 1, shops: 1, products: 1, whatsappClicks: 2 },
      last7: { signups: 1, shops: 1 },
      last30: { signups: 1, shops: 1 },
    });
  });

  test("an invalid day gives zero windows, totals unchanged", async () => {
    const t = newTest();
    const admin = await seededSuperAdmin(t);
    expect(await overview(t, admin, "not-a-day")).toEqual({
      totals: { users: 1, shops: 0, products: 0, whatsappClicks: 0 },
      last7: { signups: 0, shops: 0 },
      last30: { signups: 0, shops: 0 },
    });
  });

  test("a custom role needs dashboard.view", async () => {
    const t = newTest();
    await builtInRoles(t);
    const analyst = await insertUserWithRole(t, "a@example.com", await insertRole(t, "Analyst", ["dashboard.view"]));
    const support = await insertUserWithRole(t, "s@example.com", await insertRole(t, "Support", ["users.view"]));
    expect((await overview(t, analyst)).totals.shops).toBe(0);
    await expect(overview(t, support)).rejects.toThrow(/FORBIDDEN/);
  });

  test("sellers, suspended admins and signed-out callers are refused", async () => {
    const t = newTest();
    const ids = await builtInRoles(t);
    const seller = await insertUserWithRole(t, "seller@example.com", ids.seller);
    const suspended = await insertUserWithRole(t, "x@example.com", ids.super_admin, "suspended");
    await expect(overview(t, seller)).rejects.toThrow(/FORBIDDEN/);
    await expect(overview(t, suspended)).rejects.toThrow(/ACCOUNT_SUSPENDED/);
    await expect(t.query(api.admin.dashboard.overview, { today })).rejects.toThrow(/NOT_AUTHENTICATED/);
  });
});
