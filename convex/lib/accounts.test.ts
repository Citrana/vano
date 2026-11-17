import { describe, expect, test } from "vitest";
import { assertCanStartSession, assignSellerRoleIfMissing } from "./accounts";
import { findRoleByKey } from "./roles";
import { builtInRoles, insertUser, insertUserWithRole, newTest } from "./test.utils";

const setup = newTest;

describe("assignSellerRoleIfMissing (after sign-up)", () => {
  test("a new user becomes an active seller, creating the built-in roles", async () => {
    const t = setup();
    const userId = await insertUser(t, "new@x.com");
    await t.run(async (ctx) => {
      await assignSellerRoleIfMissing(ctx, userId);
      const seller = await findRoleByKey(ctx, "seller");
      expect(await findRoleByKey(ctx, "super_admin")).not.toBeNull();
      expect(await ctx.db.get("users", userId)).toMatchObject({
        roleId: seller!._id,
        status: "active",
      });
    });
  });

  test("never overwrites an existing role", async () => {
    const t = setup();
    const ids = await builtInRoles(t);
    const userId = await insertUserWithRole(t, "admin@x.com", ids.super_admin);
    await t.run(async (ctx) => {
      await assignSellerRoleIfMissing(ctx, userId);
      expect((await ctx.db.get("users", userId))?.roleId).toBe(ids.super_admin);
    });
  });

  test("keeps an existing suspended status", async () => {
    const t = setup();
    const userId = await t.run((ctx) => ctx.db.insert("users", { email: "x@x.com", status: "suspended" }));
    await t.run(async (ctx) => {
      await assignSellerRoleIfMissing(ctx, userId);
      expect((await ctx.db.get("users", userId))?.status).toBe("suspended");
    });
  });
});

describe("assertCanStartSession (before every sign-in)", () => {
  test("suspended users can't sign in; active and not-yet-migrated users can", async () => {
    const t = setup();
    const ids = await builtInRoles(t);
    const active = await insertUserWithRole(t, "a@x.com", ids.seller);
    const suspended = await insertUserWithRole(t, "s@x.com", ids.seller, "suspended");
    const legacy = await insertUser(t, "legacy@x.com");
    await t.run(async (ctx) => {
      await expect(assertCanStartSession(ctx, active)).resolves.toBeUndefined();
      await expect(assertCanStartSession(ctx, legacy)).resolves.toBeUndefined();
      await expect(assertCanStartSession(ctx, suspended)).rejects.toThrow(/ACCOUNT_SUSPENDED/);
    });
  });
});
