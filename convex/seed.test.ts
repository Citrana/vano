import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { findRoleByKey } from "./lib/roles";
import { as, shopArgs, newTest } from "./lib/test.utils";

const setup = newTest;
type T = ReturnType<typeof setup>;

const seed = (t: T, email: string, extra: { password?: string; force?: boolean } = {}) =>
  t.action(internal.seed.superAdmin, {
    email,
    password: extra.password ?? "password1",
    ...(extra.force === undefined ? {} : { force: extra.force }),
  });

async function userByEmail(t: T, email: string) {
  return await t.run((ctx) =>
    ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique(),
  );
}

async function superAdminRoleId(t: T): Promise<Id<"roles">> {
  return await t.run(async (ctx) => (await findRoleByKey(ctx, "super_admin"))!._id);
}

const count = (t: T, table: "authAccounts" | "auditLogs" | "users") =>
  t.run(async (ctx) => (await ctx.db.query(table).collect()).length);

describe("seed:superAdmin", () => {
  test("creates the built-in roles and an active super admin on a fresh deployment", async () => {
    const t = setup();
    expect(await seed(t, "  Boss@Example.com ")).toEqual({ result: "created", email: "boss@example.com" });
    const user = await userByEmail(t, "boss@example.com");
    expect(user).toMatchObject({ roleId: await superAdminRoleId(t), status: "active" });
    expect(await count(t, "authAccounts")).toBe(1);
    const roles = await t.run((ctx) => ctx.db.query("roles").collect());
    expect(roles.map((r) => r.key).sort()).toEqual(["seller", "super_admin"]);
    const logs = await t.run((ctx) => ctx.db.query("auditLogs").collect());
    expect(logs).toEqual([
      expect.objectContaining({
        actorEmail: "system",
        action: "superAdmin.seed",
        targetType: "user",
        targetId: user!._id,
        targetLabel: "boss@example.com",
      }),
    ]);
  });

  test("is safe to run twice with the same email", async () => {
    const t = setup();
    await seed(t, "boss@example.com");
    expect(await seed(t, "boss@example.com", { password: "another-pass" })).toEqual({
      result: "already_super_admin",
      email: "boss@example.com",
    });
    expect(await count(t, "authAccounts")).toBe(1);
    expect(await count(t, "auditLogs")).toBe(1);
  });

  test("refuses a second super admin without force, allows it with force", async () => {
    const t = setup();
    await seed(t, "boss@example.com");
    await expect(seed(t, "second@example.com")).rejects.toThrow(/SUPER_ADMIN_EXISTS/);
    // A refused run leaves nothing behind: no account, no user.
    expect(await userByEmail(t, "second@example.com")).toBeNull();
    expect(await count(t, "authAccounts")).toBe(1);

    expect(await seed(t, "second@example.com", { force: true })).toEqual({
      result: "created",
      email: "second@example.com",
    });
    expect((await userByEmail(t, "second@example.com"))?.roleId).toBe(await superAdminRoleId(t));
  });

  test("refuses to promote an existing seller without force while a super admin exists", async () => {
    const t = setup();
    await seed(t, "boss@example.com");
    await seed(t, "seller@example.com", { force: true });
    const sellerId = (await userByEmail(t, "seller@example.com"))!._id;
    await t.run(async (ctx) => {
      await ctx.db.patch("users", sellerId, { roleId: (await findRoleByKey(ctx, "seller"))!._id });
    });
    await expect(seed(t, "seller@example.com")).rejects.toThrow(/SUPER_ADMIN_EXISTS/);
  });

  test("promotes an existing seller, keeping their shop and single account", async () => {
    const t = setup();
    // A seller who signed up normally (same createAccount path as sign-up).
    await seed(t, "boss@example.com");
    await seed(t, "seller@example.com", { force: true });
    const sellerId = (await userByEmail(t, "seller@example.com"))!._id;
    await t.run(async (ctx) => {
      const seller = (await findRoleByKey(ctx, "seller"))!._id;
      await ctx.db.patch("users", sellerId, { roleId: seller });
    });
    await as(t, sellerId).mutation(api.shops.create, shopArgs());

    expect((await seed(t, "seller@example.com", { force: true })).result).toBe("promoted");
    expect((await userByEmail(t, "seller@example.com"))?.roleId).toBe(await superAdminRoleId(t));
    expect(await as(t, sellerId).query(api.shops.myShop, {})).not.toBeNull();
    const accounts = await t.run((ctx) => ctx.db.query("authAccounts").collect());
    expect(accounts.filter((a) => a.providerAccountId === "seller@example.com")).toHaveLength(1);
  });

  test("if the only super admin is suspended, a new one can be seeded without force", async () => {
    const t = setup();
    await seed(t, "boss@example.com");
    const bossId = (await userByEmail(t, "boss@example.com"))!._id;
    await t.run((ctx) => ctx.db.patch("users", bossId, { status: "suspended" }));
    expect((await seed(t, "rescue@example.com")).result).toBe("created");
  });

  test("re-running for a suspended super admin reactivates them", async () => {
    const t = setup();
    await seed(t, "boss@example.com");
    const bossId = (await userByEmail(t, "boss@example.com"))!._id;
    await t.run((ctx) => ctx.db.patch("users", bossId, { status: "suspended" }));
    expect((await seed(t, "boss@example.com")).result).toBe("promoted");
    expect((await userByEmail(t, "boss@example.com"))?.status).toBe("active");
  });

  test("rejects a bad email or short password before writing anything", async () => {
    const t = setup();
    await expect(seed(t, "not-an-email")).rejects.toThrow(/EMAIL_INVALID/);
    await expect(seed(t, "ok@example.com", { password: "short" })).rejects.toThrow(/PASSWORD_TOO_SHORT/);
    expect(await count(t, "users")).toBe(0);
    expect(await count(t, "authAccounts")).toBe(0);
  });
});
