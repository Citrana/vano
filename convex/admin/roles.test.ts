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
