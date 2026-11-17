import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  as,
  builtInRoles,
  insertRole,
  insertUserWithRole,
  newTest,
  shopArgs,
  type T,
} from "../lib/test.utils";

/** A super admin plus a few users with different roles and statuses. */
async function world(t: T) {
  const ids = await builtInRoles(t);
  const support = await insertRole(t, "Support", ["users.view", "users.suspend"]);
  const admin = await insertUserWithRole(t, "boss@vano.app", ids.super_admin);
  const amani = await insertUserWithRole(t, "amani@shop.cd", ids.seller);
  const baraka = await insertUserWithRole(t, "baraka@shop.cd", ids.seller, "suspended");
  const agent = await insertUserWithRole(t, "agent@vano.app", support);
  await as(t, amani).mutation(api.shops.create, shopArgs({ name: "Chez Amani" }));
  return { ids, support, admin, amani, baraka, agent };
}

const page = { numItems: 50, cursor: null };
const emails = (rows: { email: string }[]) => rows.map((r) => r.email).sort();

describe("admin.users.list", () => {
  test("lists everyone newest first, with role, status and shop", async () => {
    const t = newTest();
    const w = await world(t);
    const result = await as(t, w.admin).query(api.admin.users.list, { paginationOpts: page });
    expect(result.page.map((r) => r.email)).toEqual([
      "agent@vano.app",
      "baraka@shop.cd",
      "amani@shop.cd",
      "boss@vano.app",
    ]);
    expect(result.page.find((r) => r.email === "amani@shop.cd")).toMatchObject({
      roleKey: "seller",
      roleName: "Seller",
      status: "active",
      shopName: "Chez Amani",
    });
    expect(result.page.find((r) => r.email === "agent@vano.app")).toMatchObject({
      roleKey: null,
      roleName: "Support",
      shopName: null,
    });
  });

  test("filters by role, status, both, and searches the email", async () => {
    const t = newTest();
    const w = await world(t);
    const q = (args: { search?: string; roleId?: Id<"roles">; status?: "active" | "suspended" }) =>
      as(t, w.admin).query(api.admin.users.list, { paginationOpts: page, ...args });

    expect(emails((await q({ roleId: w.ids.seller })).page)).toEqual(["amani@shop.cd", "baraka@shop.cd"]);
    expect(emails((await q({ status: "suspended" })).page)).toEqual(["baraka@shop.cd"]);
    expect(emails((await q({ roleId: w.ids.seller, status: "active" })).page)).toEqual(["amani@shop.cd"]);
    // Search from the start of the address: real Convex also matches words
    // after "@" / ".", but convex-test's simplified search doesn't.
    expect(emails((await q({ search: "ama" })).page)).toEqual(["amani@shop.cd"]);
    expect(emails((await q({ search: "  bar ", status: "suspended" })).page)).toEqual(["baraka@shop.cd"]);
    expect((await q({ search: "bar", status: "active" })).page).toEqual([]);
    expect(emails((await q({ search: "agent", roleId: w.support })).page)).toEqual(["agent@vano.app"]);
  });

  test("paginates", async () => {
    const t = newTest();
    const w = await world(t);
    const first = await as(t, w.admin).query(api.admin.users.list, { paginationOpts: { numItems: 3, cursor: null } });
    expect(first.page).toHaveLength(3);
    expect(first.isDone).toBe(false);
    const second = await as(t, w.admin).query(api.admin.users.list, {
      paginationOpts: { numItems: 3, cursor: first.continueCursor },
    });
    expect(second.page.map((r) => r.email)).toEqual(["boss@vano.app"]);
  });

  test("needs users.view; suspended and signed-out callers are refused", async () => {
    const t = newTest();
    const w = await world(t);
    const nope = await insertUserWithRole(t, "x@vano.app", await insertRole(t, "Analyst", ["dashboard.view"]));
    await expect(as(t, nope).query(api.admin.users.list, { paginationOpts: page })).rejects.toThrow(/FORBIDDEN/);
    await expect(as(t, w.amani).query(api.admin.users.list, { paginationOpts: page })).rejects.toThrow(/FORBIDDEN/);
    await expect(as(t, w.baraka).query(api.admin.users.list, { paginationOpts: page })).rejects.toThrow(
      /ACCOUNT_SUSPENDED/,
    );
    await expect(t.query(api.admin.users.list, { paginationOpts: page })).rejects.toThrow(/NOT_AUTHENTICATED/);
    // A custom role with users.view is enough.
    expect((await as(t, w.agent).query(api.admin.users.list, { paginationOpts: page })).page).toHaveLength(5);
  });
});

describe("admin.users.get", () => {
  test("details with role, shop and hints; null for unknown ids", async () => {
    const t = newTest();
    const w = await world(t);
    const amani = await as(t, w.admin).query(api.admin.users.get, { userId: w.amani });
    expect(amani).toMatchObject({
      email: "amani@shop.cd",
      status: "active",
      role: { key: "seller", name: "Seller" },
      shop: { name: "Chez Amani", slug: "chez-amani", status: "active" },
      isSelf: false,
      isSuperAdmin: false,
    });
    expect(await as(t, w.admin).query(api.admin.users.get, { userId: w.admin })).toMatchObject({
      isSelf: true,
      isSuperAdmin: true,
      shop: null,
    });
    expect(await as(t, w.admin).query(api.admin.users.get, { userId: "not-an-id" })).toBeNull();
    // A valid id from another table is not a user.
    expect(await as(t, w.admin).query(api.admin.users.get, { userId: w.support })).toBeNull();
  });

  test("needs users.view", async () => {
    const t = newTest();
    const w = await world(t);
    await expect(as(t, w.amani).query(api.admin.users.get, { userId: w.admin })).rejects.toThrow(/FORBIDDEN/);
  });
});

describe("admin.users.roleOptions", () => {
  test("lists built-in and custom roles; needs users.view", async () => {
    const t = newTest();
    const w = await world(t);
    const roles = await as(t, w.agent).query(api.admin.users.roleOptions, {});
    expect(roles.map((r) => r.name).sort()).toEqual(["Seller", "Super admin", "Support"]);
    await expect(as(t, w.amani).query(api.admin.users.roleOptions, {})).rejects.toThrow(/FORBIDDEN/);
  });
});

async function signIn(t: T, userId: Id<"users">) {
  return await t.run(async (ctx) => {
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 1e9 });
    await ctx.db.insert("authRefreshTokens", { sessionId, expirationTime: Date.now() + 1e9 });
    return sessionId;
  });
}

const audit = (t: T) => t.run((ctx) => ctx.db.query("auditLogs").collect());

describe("admin.users.setStatus", () => {
  test("suspending signs the user out everywhere and is logged", async () => {
    const t = newTest();
    const w = await world(t);
    await signIn(t, w.amani);
    await signIn(t, w.amani);
    const other = await signIn(t, w.agent);

    await as(t, w.admin).mutation(api.admin.users.setStatus, { userId: w.amani, status: "suspended" });

    expect((await t.run((ctx) => ctx.db.get("users", w.amani)))?.status).toBe("suspended");
    const sessions = await t.run((ctx) => ctx.db.query("authSessions").collect());
    expect(sessions.map((s) => s._id)).toEqual([other]);
    const tokens = await t.run((ctx) => ctx.db.query("authRefreshTokens").collect());
    expect(tokens.map((tk) => tk.sessionId)).toEqual([other]);
    expect(await audit(t)).toEqual([
      expect.objectContaining({
        actorId: w.admin,
        actorEmail: "boss@vano.app",
        action: "user.suspend",
        targetType: "user",
        targetId: w.amani,
        targetLabel: "amani@shop.cd",
      }),
    ]);
    // Every function now refuses them.
    await expect(as(t, w.amani).query(api.shops.myShop, {})).rejects.toThrow(/ACCOUNT_SUSPENDED/);
  });

  test("reactivating works; the same status again changes nothing", async () => {
    const t = newTest();
    const w = await world(t);
    await as(t, w.admin).mutation(api.admin.users.setStatus, { userId: w.baraka, status: "active" });
    await as(t, w.admin).mutation(api.admin.users.setStatus, { userId: w.baraka, status: "active" });
    expect((await t.run((ctx) => ctx.db.get("users", w.baraka)))?.status).toBe("active");
    expect((await audit(t)).map((a) => a.action)).toEqual(["user.reactivate"]);
  });

  test("safety rules: not yourself, super admins only by super admins", async () => {
    const t = newTest();
    const w = await world(t);
    await expect(
      as(t, w.admin).mutation(api.admin.users.setStatus, { userId: w.admin, status: "suspended" }),
    ).rejects.toThrow(/CANNOT_MODIFY_SELF/);
    // Support has users.suspend but isn't a super admin.
    await expect(
      as(t, w.agent).mutation(api.admin.users.setStatus, { userId: w.admin, status: "suspended" }),
    ).rejects.toThrow(/FORBIDDEN/);
    await as(t, w.agent).mutation(api.admin.users.setStatus, { userId: w.amani, status: "suspended" });
    expect(await audit(t)).toHaveLength(1);
  });

  test("needs users.suspend", async () => {
    const t = newTest();
    const w = await world(t);
    const viewer = await insertUserWithRole(t, "v@vano.app", await insertRole(t, "Viewer", ["users.view"]));
    await expect(
      as(t, viewer).mutation(api.admin.users.setStatus, { userId: w.amani, status: "suspended" }),
    ).rejects.toThrow(/FORBIDDEN/);
  });
});

describe("admin.users.assignRole", () => {
  test("changes the role and logs old and new names", async () => {
    const t = newTest();
    const w = await world(t);
    await as(t, w.admin).mutation(api.admin.users.assignRole, { userId: w.amani, roleId: w.support });
    expect((await t.run((ctx) => ctx.db.get("users", w.amani)))?.roleId).toBe(w.support);
    expect(await audit(t)).toEqual([
      expect.objectContaining({
        action: "user.assignRole",
        targetId: w.amani,
        details: { from: "Seller", to: "Support" },
      }),
    ]);
    // Same role again: nothing happens.
    await as(t, w.admin).mutation(api.admin.users.assignRole, { userId: w.amani, roleId: w.support });
    expect(await audit(t)).toHaveLength(1);
  });

  test("no escalation; super admin only granted by a super admin", async () => {
    const t = newTest();
    const w = await world(t);
    const manager = await insertUserWithRole(
      t,
      "m@vano.app",
      await insertRole(t, "Manager", ["users.view", "users.assignRole"]),
    );
    // Support has users.suspend, which the manager doesn't hold.
    await expect(
      as(t, manager).mutation(api.admin.users.assignRole, { userId: w.amani, roleId: w.support }),
    ).rejects.toThrow(/PERMISSION_ESCALATION/);
    await expect(
      as(t, manager).mutation(api.admin.users.assignRole, { userId: w.amani, roleId: w.ids.super_admin }),
    ).rejects.toThrow(/FORBIDDEN/);
    // A role within their own permissions is fine.
    const viewerRole = await insertRole(t, "Viewer", ["users.view"]);
    await as(t, manager).mutation(api.admin.users.assignRole, { userId: w.amani, roleId: viewerRole });
  });

  test("not yourself; unknown role; needs users.assignRole", async () => {
    const t = newTest();
    const w = await world(t);
    await expect(
      as(t, w.admin).mutation(api.admin.users.assignRole, { userId: w.admin, roleId: w.ids.seller }),
    ).rejects.toThrow(/CANNOT_MODIFY_SELF/);
    const ghost = await t.run(async (ctx) => {
      const id = await ctx.db.insert("roles", { name: "Ghost", permissions: [] });
      await ctx.db.delete("roles", id);
      return id;
    });
    await expect(
      as(t, w.admin).mutation(api.admin.users.assignRole, { userId: w.amani, roleId: ghost }),
    ).rejects.toThrow(/NOT_FOUND/);
    await expect(
      as(t, w.agent).mutation(api.admin.users.assignRole, { userId: w.amani, roleId: w.ids.seller }),
    ).rejects.toThrow(/FORBIDDEN/);
  });

  test("a second super admin can demote the first", async () => {
    const t = newTest();
    const w = await world(t);
    const second = await insertUserWithRole(t, "two@vano.app", w.ids.super_admin);
    await as(t, second).mutation(api.admin.users.assignRole, { userId: w.admin, roleId: w.ids.seller });
    expect((await t.run((ctx) => ctx.db.get("users", w.admin)))?.roleId).toBe(w.ids.seller);
  });
});
