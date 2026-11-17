import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { ALL_PERMISSIONS, SELLER_PERMISSIONS } from "../lib/permissions";
import { as, builtInRoles, insertRole, insertUserWithRole, newTest, type T } from "../lib/test.utils";

/** A super admin, a role manager, and a couple of custom roles. */
async function world(t: T) {
  const ids = await builtInRoles(t);
  const support = await insertRole(t, "Support", ["users.view", "users.suspend"]);
  const manager = await insertRole(t, "Role manager", ["roles.view", "roles.manage", "users.view"]);
  const admin = await insertUserWithRole(t, "boss@vano.app", ids.super_admin);
  const rm = await insertUserWithRole(t, "rm@vano.app", manager);
  const agent = await insertUserWithRole(t, "agent@vano.app", support);
  const seller = await insertUserWithRole(t, "s@shop.cd", ids.seller);
  await insertUserWithRole(t, "gone@shop.cd", ids.seller, "suspended");
  return { ids, support, manager, admin, rm, agent, seller };
}

describe("admin.roles.list", () => {
  test("built-ins first, effective permissions, user counts", async () => {
    const t = newTest();
    const w = await world(t);
    const roles = await as(t, w.admin).query(api.admin.roles.list, {});
    expect(roles.map((r) => r.name)).toEqual(["Super admin", "Seller", "Role manager", "Support"]);
    const [superAdmin, seller, , support] = roles;
    expect(superAdmin.permissions).toEqual([...ALL_PERMISSIONS]);
    expect(seller.permissions).toEqual([...SELLER_PERMISSIONS]);
    // Suspended holders count too.
    expect(seller).toMatchObject({ key: "seller", userCount: 2, userCountCapped: false });
    expect(support).toMatchObject({ key: null, permissions: ["users.view", "users.suspend"], userCount: 1 });
  });

  test("caps the user count", async () => {
    const t = newTest();
    const w = await world(t);
    await t.run(async (ctx) => {
      for (let i = 0; i < 105; i++) await ctx.db.insert("users", { email: `u${i}@x.cd`, roleId: w.support, status: "active" });
    });
    const support = (await as(t, w.admin).query(api.admin.roles.list, {})).find((r) => r.name === "Support");
    expect(support).toMatchObject({ userCount: 100, userCountCapped: true });
  });

  test("needs roles.view; suspended and signed-out callers are refused", async () => {
    const t = newTest();
    const w = await world(t);
    await expect(as(t, w.agent).query(api.admin.roles.list, {})).rejects.toThrow(/FORBIDDEN/);
    await expect(as(t, w.seller).query(api.admin.roles.list, {})).rejects.toThrow(/FORBIDDEN/);
    await t.run((ctx) => ctx.db.patch("users", w.rm, { status: "suspended" }));
    await expect(as(t, w.rm).query(api.admin.roles.list, {})).rejects.toThrow(/ACCOUNT_SUSPENDED/);
    await expect(t.query(api.admin.roles.list, {})).rejects.toThrow(/NOT_AUTHENTICATED/);
  });
});

describe("admin.roles.get", () => {
  test("details with hints; null for unknown ids", async () => {
    const t = newTest();
    const w = await world(t);
    expect(await as(t, w.rm).query(api.admin.roles.get, { roleId: w.ids.seller })).toMatchObject({
      name: "Seller",
      isBuiltIn: true,
      isOwnRole: false,
    });
    expect(await as(t, w.rm).query(api.admin.roles.get, { roleId: w.manager })).toMatchObject({
      isBuiltIn: false,
      isOwnRole: true,
    });
    expect(await as(t, w.rm).query(api.admin.roles.get, { roleId: "nope" })).toBeNull();
    expect(await as(t, w.rm).query(api.admin.roles.get, { roleId: w.admin })).toBeNull();
    await expect(as(t, w.agent).query(api.admin.roles.get, { roleId: w.support })).rejects.toThrow(/FORBIDDEN/);
  });
});

const audit = (t: T) => t.run((ctx) => ctx.db.query("auditLogs").collect());
const input = (over: Partial<{ name: string; description: string; permissions: string[] }> = {}) => ({
  name: "Moderator",
  description: "Hides bad products",
  permissions: ["products.view", "products.hide"],
  ...over,
});

describe("admin.roles.create", () => {
  test("creates the role and logs it; unknown permissions are dropped", async () => {
    const t = newTest();
    const w = await world(t);
    const roleId = await as(t, w.admin).mutation(
      api.admin.roles.create,
      input({ name: "  Moderator ", permissions: ["products.view", "nope.do", "products.hide", "products.view"] }),
    );
    expect(await t.run((ctx) => ctx.db.get("roles", roleId))).toMatchObject({
      name: "Moderator",
      description: "Hides bad products",
      permissions: ["products.view", "products.hide"],
    });
    expect(await audit(t)).toEqual([
      expect.objectContaining({
        action: "role.create",
        targetType: "role",
        targetId: roleId,
        targetLabel: "Moderator",
        details: { permissions: "products.view, products.hide" },
      }),
    ]);
  });

  test("validates the name and description", async () => {
    const t = newTest();
    const w = await world(t);
    const create = (over: Parameters<typeof input>[0]) => as(t, w.admin).mutation(api.admin.roles.create, input(over));
    await expect(create({ name: " x " })).rejects.toThrow(/ROLE_NAME_INVALID/);
    await expect(create({ name: "support" })).rejects.toThrow(/ROLE_NAME_TAKEN/);
    await expect(create({ name: "SELLER" })).rejects.toThrow(/ROLE_NAME_TAKEN/);
    await expect(create({ name: "super admin" })).rejects.toThrow(/ROLE_NAME_TAKEN/);
    await expect(create({ description: "x".repeat(201) })).rejects.toThrow(/DESCRIPTION_TOO_LONG/);
  });

  test("you can only grant permissions you hold", async () => {
    const t = newTest();
    const w = await world(t);
    await expect(
      as(t, w.rm).mutation(api.admin.roles.create, input({ permissions: ["users.view", "shops.delete"] })),
    ).rejects.toThrow(/PERMISSION_ESCALATION/);
    await as(t, w.rm).mutation(api.admin.roles.create, input({ permissions: ["users.view"] }));
  });

  test("needs roles.manage", async () => {
    const t = newTest();
    const w = await world(t);
    const viewerOnly = await insertUserWithRole(t, "v@vano.app", await insertRole(t, "Viewer", ["roles.view"]));
    await expect(as(t, viewerOnly).mutation(api.admin.roles.create, input())).rejects.toThrow(/FORBIDDEN/);
    await expect(as(t, w.seller).mutation(api.admin.roles.create, input())).rejects.toThrow(/FORBIDDEN/);
    await expect(t.mutation(api.admin.roles.create, input())).rejects.toThrow(/NOT_AUTHENTICATED/);
  });
});

describe("admin.roles.update", () => {
  test("edits the role, logs added/removed, holders get it immediately", async () => {
    const t = newTest();
    const w = await world(t);
    await as(t, w.admin).mutation(api.admin.roles.update, {
      roleId: w.support,
      name: "Customer support",
      permissions: ["users.view", "dashboard.view"],
    });
    expect(await audit(t)).toEqual([
      expect.objectContaining({
        action: "role.update",
        targetLabel: "Customer support",
        details: { added: "dashboard.view", removed: "users.suspend", renamedFrom: "Support" },
      }),
    ]);
    // The agent (Support) now sees the dashboard and lost users.suspend.
    expect((await as(t, w.agent).query(api.users.viewer, {}))?.permissions).toEqual(["dashboard.view", "users.view"]);
    await as(t, w.agent).query(api.admin.dashboard.overview, { today: "2026-11-17" });
    await expect(
      as(t, w.agent).mutation(api.admin.users.setStatus, { userId: w.seller, status: "suspended" }),
    ).rejects.toThrow(/FORBIDDEN/);
  });

  test("built-in roles and your own role can't be edited", async () => {
    const t = newTest();
    const w = await world(t);
    await expect(
      as(t, w.admin).mutation(api.admin.roles.update, { roleId: w.ids.seller, name: "Seller", permissions: [] }),
    ).rejects.toThrow(/ROLE_BUILT_IN/);
    await expect(
      as(t, w.rm).mutation(api.admin.roles.update, { roleId: w.manager, name: "Role manager", permissions: ["roles.view"] }),
    ).rejects.toThrow(/CANNOT_MODIFY_SELF/);
  });

  test("no escalation: can't add or remove permissions you don't hold", async () => {
    const t = newTest();
    const w = await world(t);
    // Support has users.suspend, which the role manager doesn't hold.
    await expect(
      as(t, w.rm).mutation(api.admin.roles.update, { roleId: w.support, name: "Support", permissions: ["users.view"] }),
    ).rejects.toThrow(/PERMISSION_ESCALATION/);
    const viewers = await insertRole(t, "Viewers", ["users.view"]);
    await expect(
      as(t, w.rm).mutation(api.admin.roles.update, { roleId: viewers, name: "Viewers", permissions: ["users.view", "shops.view"] }),
    ).rejects.toThrow(/PERMISSION_ESCALATION/);
    await as(t, w.rm).mutation(api.admin.roles.update, { roleId: viewers, name: "Viewers", permissions: ["users.view", "roles.view"] });
  });

  test("names stay unique; keeping your own name is fine", async () => {
    const t = newTest();
    const w = await world(t);
    await expect(
      as(t, w.admin).mutation(api.admin.roles.update, { roleId: w.support, name: "role MANAGER", permissions: [] }),
    ).rejects.toThrow(/ROLE_NAME_TAKEN/);
    await as(t, w.admin).mutation(api.admin.roles.update, { roleId: w.support, name: "SUPPORT", permissions: [] });
  });
});

describe("admin.roles.remove", () => {
  test("deletes an unused custom role and logs it", async () => {
    const t = newTest();
    const w = await world(t);
    const unused = await insertRole(t, "Unused", ["users.view"]);
    await as(t, w.admin).mutation(api.admin.roles.remove, { roleId: unused });
    expect(await t.run((ctx) => ctx.db.get("roles", unused))).toBeNull();
    expect((await audit(t)).map((a) => [a.action, a.targetLabel])).toEqual([["role.delete", "Unused"]]);
  });

  test("refuses roles in use (suspended holders too) and built-in roles", async () => {
    const t = newTest();
    const w = await world(t);
    await expect(as(t, w.admin).mutation(api.admin.roles.remove, { roleId: w.support })).rejects.toThrow(/ROLE_IN_USE/);
    const lonely = await insertRole(t, "Lonely", []);
    await insertUserWithRole(t, "z@x.cd", lonely, "suspended");
    await expect(as(t, w.admin).mutation(api.admin.roles.remove, { roleId: lonely })).rejects.toThrow(/ROLE_IN_USE/);
    await expect(as(t, w.admin).mutation(api.admin.roles.remove, { roleId: w.ids.seller })).rejects.toThrow(/ROLE_BUILT_IN/);
    await expect(as(t, w.agent).mutation(api.admin.roles.remove, { roleId: lonely })).rejects.toThrow(/FORBIDDEN/);
  });
});
