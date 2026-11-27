import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import * as seedModule from "./seed";
import { findRoleByKey } from "./lib/roles";
import { as, shopArgs, newTest } from "./lib/test.utils";

const setup = newTest;
type T = ReturnType<typeof setup>;

type SeedFlags = { password?: string; force?: boolean; promoteExisting?: boolean; replaceUnverified?: boolean };

const seed = (t: T, email: string, { password, ...flags }: SeedFlags = {}) =>
  t.action(internal.seed.superAdmin, { email, password: password ?? "password1", ...flags });

async function userByEmail(t: T, email: string) {
  return await t.run((ctx) =>
    ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique(),
  );
}

async function accountOf(t: T, email: string) {
  return await t.run((ctx) =>
    ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) => q.eq("provider", "password").eq("providerAccountId", email))
      .unique(),
  );
}

async function superAdminRoleId(t: T): Promise<Id<"roles">> {
  return await t.run(async (ctx) => (await findRoleByKey(ctx, "super_admin"))!._id);
}

const count = (t: T, table: "authAccounts" | "auditLogs" | "users" | "authSessions" | "authRefreshTokens") =>
  t.run(async (ctx) => (await ctx.db.query(table).collect()).length);

/** Someone signed up with this email and never entered the code (no session, unverified). */
async function insertUnverifiedAccount(t: T, email: string): Promise<Id<"users">> {
  return await t.run(async (ctx) => {
    const seller = (await findRoleByKey(ctx, "seller"))?._id;
    const userId = await ctx.db.insert("users", { email, ...(seller ? { roleId: seller, status: "active" as const } : {}) });
    const accountId = await ctx.db.insert("authAccounts", {
      userId,
      provider: "password",
      providerAccountId: email,
      secret: "squatter-password-hash",
    });
    await ctx.db.insert("authVerificationCodes", {
      accountId,
      provider: "password-verify",
      code: "hashed-code",
      expirationTime: Date.now() + 60_000,
    });
    return userId;
  });
}

/** A verified seller (created the normal way, then made a plain seller). */
async function verifiedSeller(t: T, email: string): Promise<Id<"users">> {
  await seed(t, email, { force: true });
  const userId = (await userByEmail(t, email))!._id;
  await t.run(async (ctx) => {
    await ctx.db.patch("users", userId, { roleId: (await findRoleByKey(ctx, "seller"))!._id });
  });
  return userId;
}

/** A signed-in session with a refresh token. */
async function insertSession(t: T, userId: Id<"users">) {
  await t.run(async (ctx) => {
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 3_600_000 });
    await ctx.db.insert("authRefreshTokens", { sessionId, expirationTime: Date.now() + 3_600_000 });
  });
}

describe("seed:superAdmin is operator-only", () => {
  test("every function in convex/seed.ts is internal (never callable from the app)", () => {
    const fns = Object.entries(seedModule).filter(([, value]) => typeof value === "function" || typeof value === "object");
    expect(fns.length).toBeGreaterThan(0);
    for (const [name, fn] of fns) {
      const flags = fn as { isInternal?: boolean; isPublic?: boolean };
      expect({ name, isInternal: flags.isInternal, isPublic: flags.isPublic }).toEqual({ name, isInternal: true, isPublic: undefined });
    }
  });
});

describe("seed:superAdmin, new account", () => {
  test("creates the built-in roles and an active, verified super admin", async () => {
    const t = setup();
    expect(await seed(t, "  Boss@Example.com ")).toEqual({
      result: "created",
      email: "boss@example.com",
      passwordReset: false,
      sessionsRevoked: false,
      message: expect.stringContaining("Created a new super admin account for boss@example.com"),
    });
    const user = await userByEmail(t, "boss@example.com");
    expect(user).toMatchObject({ roleId: await superAdminRoleId(t), status: "active", emailVerificationTime: expect.any(Number) });
    expect((await accountOf(t, "boss@example.com"))!.emailVerified).toBe("boss@example.com");
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

  test("refuses a second super admin without force, allows it with force", async () => {
    const t = setup();
    await seed(t, "boss@example.com");
    await expect(seed(t, "second@example.com")).rejects.toThrow(/SUPER_ADMIN_EXISTS/);
    // A refused run leaves nothing behind: no account, no user.
    expect(await userByEmail(t, "second@example.com")).toBeNull();
    expect(await count(t, "authAccounts")).toBe(1);
    expect((await seed(t, "second@example.com", { force: true })).result).toBe("created");
    expect((await userByEmail(t, "second@example.com"))?.roleId).toBe(await superAdminRoleId(t));
  });

  test("if the only super admin is suspended, a new one can be seeded without force", async () => {
    const t = setup();
    await seed(t, "boss@example.com");
    const bossId = (await userByEmail(t, "boss@example.com"))!._id;
    await t.run((ctx) => ctx.db.patch("users", bossId, { status: "suspended" }));
    expect((await seed(t, "rescue@example.com")).result).toBe("created");
  });

  test("rejects a bad email or short password before writing anything", async () => {
    const t = setup();
    await expect(seed(t, "not-an-email")).rejects.toThrow(/EMAIL_INVALID/);
    await expect(seed(t, "ok@example.com", { password: "short" })).rejects.toThrow(/PASSWORD_TOO_SHORT/);
    expect(await count(t, "users")).toBe(0);
    expect(await count(t, "authAccounts")).toBe(0);
  });

  test("still works while public sign-up is closed (one-time bypass, used up)", async () => {
    const t = setup();
    await t.run((ctx) => ctx.db.insert("platformSettings", { signupEnabled: false }));
    expect((await seed(t, "boss@example.com")).result).toBe("created");
    expect((await userByEmail(t, "boss@example.com"))?.roleId).toBe(await superAdminRoleId(t));
    expect(await t.run((ctx) => ctx.db.query("signupBypasses").collect())).toEqual([]);
  });

  test("a refused run leaves no sign-up permission behind", async () => {
    const t = setup();
    await seed(t, "boss@example.com");
    await t.run((ctx) => ctx.db.insert("platformSettings", { signupEnabled: false }));
    await expect(seed(t, "second@example.com")).rejects.toThrow(/SUPER_ADMIN_EXISTS/);
    expect(await t.run((ctx) => ctx.db.query("signupBypasses").collect())).toEqual([]);
  });
});

describe("seed:superAdmin, unverified account (possible squatter)", () => {
  test("is never promoted and never marked verified without the flag", async () => {
    const t = setup();
    const squatter = await insertUnverifiedAccount(t, "boss@example.com");
    await expect(seed(t, "boss@example.com")).rejects.toThrow(/SEED_UNVERIFIED_ACCOUNT.*never verified/);
    // Even with the other flags.
    await expect(seed(t, "boss@example.com", { force: true, promoteExisting: true })).rejects.toThrow(
      /SEED_UNVERIFIED_ACCOUNT/,
    );
    const user = await t.run((ctx) => ctx.db.get("users", squatter));
    expect(user?.roleId).not.toBe(await superAdminRoleId(t));
    expect(user?.emailVerificationTime).toBeUndefined();
    const account = await accountOf(t, "boss@example.com");
    expect(account!.secret).toBe("squatter-password-hash");
    expect(account!.emailVerified).toBeUndefined();
  });

  test("replaceUnverified deletes it and creates a fresh, verified super admin with the given password", async () => {
    const t = setup();
    const squatter = await insertUnverifiedAccount(t, "boss@example.com");
    const usersBefore = await count(t, "users");
    const result = await seed(t, "boss@example.com", { replaceUnverified: true, password: "owner-password" });
    expect(result).toMatchObject({ result: "replaced_unverified", passwordReset: false, sessionsRevoked: false });
    expect(await t.run((ctx) => ctx.db.get("users", squatter))).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("authVerificationCodes").collect())).toEqual([]);

    const user = await userByEmail(t, "boss@example.com");
    expect(user!._id).not.toBe(squatter);
    expect(user).toMatchObject({ roleId: await superAdminRoleId(t), emailVerificationTime: expect.any(Number) });
    const account = await accountOf(t, "boss@example.com");
    expect(account!.userId).toBe(user!._id);
    expect(account!.secret).not.toBe("squatter-password-hash");
    expect(account!.emailVerified).toBe("boss@example.com");
    expect(await count(t, "users")).toBe(usersBefore);
    const actions = (await t.run((ctx) => ctx.db.query("auditLogs").collect())).map((l) => l.action);
    expect(actions).toEqual(["superAdmin.replaceUnverified", "superAdmin.seed"]);
  });

  test("replaceUnverified refuses an account that owns a shop, keeping it", async () => {
    const t = setup();
    const squatter = await insertUnverifiedAccount(t, "boss@example.com");
    await as(t, squatter).mutation(api.shops.create, shopArgs());
    await expect(seed(t, "boss@example.com", { replaceUnverified: true })).rejects.toThrow(/SEED_ACCOUNT_IN_USE/);
    expect(await t.run((ctx) => ctx.db.get("users", squatter))).not.toBeNull();
  });

  test("replaceUnverified still respects another active super admin (force)", async () => {
    const t = setup();
    await seed(t, "boss@example.com");
    const squatter = await insertUnverifiedAccount(t, "second@example.com");
    await expect(seed(t, "second@example.com", { replaceUnverified: true })).rejects.toThrow(/SUPER_ADMIN_EXISTS/);
    expect(await t.run((ctx) => ctx.db.get("users", squatter))).not.toBeNull();
  });
});

describe("seed:superAdmin, verified existing account", () => {
  test("is refused without promoteExisting: nothing changes, the password isn't used", async () => {
    const t = setup();
    const sellerId = await verifiedSeller(t, "seller@example.com");
    const before = await accountOf(t, "seller@example.com");
    await insertSession(t, sellerId);
    await expect(seed(t, "seller@example.com", { force: true, password: "new-password" })).rejects.toThrow(
      /SEED_EXISTING_ACCOUNT.*password was not used/,
    );
    expect((await userByEmail(t, "seller@example.com"))?.roleId).not.toBe(await superAdminRoleId(t));
    expect((await accountOf(t, "seller@example.com"))!.secret).toBe(before!.secret);
    expect(await count(t, "authSessions")).toBe(1);
  });

  test("promoteExisting resets the password, signs every session out and promotes, keeping the shop", async () => {
    const t = setup();
    const sellerId = await verifiedSeller(t, "seller@example.com");
    await as(t, sellerId).mutation(api.shops.create, shopArgs());
    const before = await accountOf(t, "seller@example.com");
    await insertSession(t, sellerId);
    await insertSession(t, sellerId);

    const result = await seed(t, "seller@example.com", { force: true, promoteExisting: true, password: "new-password" });
    expect(result).toMatchObject({
      result: "promoted",
      passwordReset: true,
      sessionsRevoked: true,
      message: expect.stringContaining("password reset"),
    });
    expect((await userByEmail(t, "seller@example.com"))?.roleId).toBe(await superAdminRoleId(t));
    const after = await accountOf(t, "seller@example.com");
    expect(after!.secret).not.toBe(before!.secret);
    expect(after!._id).toBe(before!._id);
    expect(await count(t, "authSessions")).toBe(0);
    expect(await count(t, "authRefreshTokens")).toBe(0);
    expect(await as(t, sellerId).query(api.shops.myShop, {})).not.toBeNull();
  });

  test("promoteExisting still respects another active super admin (force)", async () => {
    const t = setup();
    await seed(t, "boss@example.com");
    await verifiedSeller(t, "seller@example.com");
    const before = await accountOf(t, "seller@example.com");
    await expect(seed(t, "seller@example.com", { promoteExisting: true })).rejects.toThrow(/SUPER_ADMIN_EXISTS/);
    // Refused before the password is touched.
    expect((await accountOf(t, "seller@example.com"))!.secret).toBe(before!.secret);
  });

  test("re-running for the active super admin changes nothing and says the password wasn't changed", async () => {
    const t = setup();
    await seed(t, "boss@example.com");
    const before = await accountOf(t, "boss@example.com");
    expect(await seed(t, "boss@example.com", { password: "another-pass" })).toEqual({
      result: "already_super_admin",
      email: "boss@example.com",
      passwordReset: false,
      sessionsRevoked: false,
      message: expect.stringContaining("password was NOT changed"),
    });
    expect((await accountOf(t, "boss@example.com"))!.secret).toBe(before!.secret);
    expect(await count(t, "authAccounts")).toBe(1);
    expect(await count(t, "auditLogs")).toBe(1);
  });

  test("the active super admin's password is reset only with promoteExisting", async () => {
    const t = setup();
    await seed(t, "boss@example.com");
    const bossId = (await userByEmail(t, "boss@example.com"))!._id;
    const before = await accountOf(t, "boss@example.com");
    await insertSession(t, bossId);
    const result = await seed(t, "boss@example.com", { promoteExisting: true, password: "another-pass" });
    expect(result).toMatchObject({ result: "already_super_admin", passwordReset: true, sessionsRevoked: true });
    expect((await accountOf(t, "boss@example.com"))!.secret).not.toBe(before!.secret);
    expect(await count(t, "authSessions")).toBe(0);
  });

  test("a suspended super admin is reactivated only with promoteExisting", async () => {
    const t = setup();
    await seed(t, "boss@example.com");
    const bossId = (await userByEmail(t, "boss@example.com"))!._id;
    await t.run((ctx) => ctx.db.patch("users", bossId, { status: "suspended" }));
    await expect(seed(t, "boss@example.com")).rejects.toThrow(/SEED_EXISTING_ACCOUNT/);
    expect((await userByEmail(t, "boss@example.com"))?.status).toBe("suspended");
    expect((await seed(t, "boss@example.com", { promoteExisting: true })).result).toBe("promoted");
    expect((await userByEmail(t, "boss@example.com"))?.status).toBe("active");
  });
});

describe("seed.promote (internal)", () => {
  test("never promotes an unverified login unless it's the seed's own new account", async () => {
    const t = setup();
    const squatter = await insertUnverifiedAccount(t, "late@example.com");
    await expect(
      t.mutation(internal.seed.promote, { userId: squatter, force: true, markVerified: false, revokeSessions: false }),
    ).rejects.toThrow(/SEED_UNVERIFIED_ACCOUNT/);
    expect((await accountOf(t, "late@example.com"))!.emailVerified).toBeUndefined();
  });
});
