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
