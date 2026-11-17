import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import schema from "../schema";
import { hasPermission, isAdmin, type Access } from "./access";
import { assertCanChangeUser, assertCanDeleteRole, assertCanWriteRole } from "./guards";
import { cleanPermissions } from "./permissions";
import { ensureBuiltInRoles, permissionsOf } from "./roles";
import { builtInRoles, insertRole, insertUserWithRole } from "./test.utils";

const modules = import.meta.glob("../**/*.*s");
const setup = () => convexTest(schema, modules);

async function accessOf(ctx: MutationCtx, userId: Id<"users">): Promise<Access> {
  const user = (await ctx.db.get("users", userId))!;
  const role = user.roleId ? await ctx.db.get("roles", user.roleId) : null;
  return {
    user,
    role,
    permissions: new Set(role ? permissionsOf(role) : []),
    isSuperAdmin: role?.key === "super_admin",
  };
}

describe("roles", () => {
  test("ensureBuiltInRoles is idempotent", async () => {
    const t = setup();
    const first = await builtInRoles(t);
    const second = await builtInRoles(t);
    expect(second).toEqual(first);
    const roles = await t.run((ctx) => ctx.db.query("roles").collect());
    expect(roles.map((r) => r.key).sort()).toEqual(["seller", "super_admin"]);
  });

  test("super admin has every permission, seller the fixed set", async () => {
    const t = setup();
    const ids = await builtInRoles(t);
    await t.run(async (ctx) => {
      const sa = (await ctx.db.get("roles", ids.super_admin))!;
      const seller = (await ctx.db.get("roles", ids.seller))!;
      expect(permissionsOf(sa)).toContain("roles.manage");
      expect(permissionsOf(seller)).not.toContain("users.view");
      expect(permissionsOf(seller)).toContain("ownShop.manage");
    });
  });
});

describe("access", () => {
  test("hasPermission and isAdmin", async () => {
    const t = setup();
    const ids = await builtInRoles(t);
    const support = await insertRole(t, "Support", ["users.view", "unknown.thing"]);
    const a = await insertUserWithRole(t, "admin@x.com", ids.super_admin);
    const s = await insertUserWithRole(t, "seller@x.com", ids.seller);
    const sup = await insertUserWithRole(t, "support@x.com", support);
    await t.run(async (ctx) => {
      const admin = await accessOf(ctx, a);
      const seller = await accessOf(ctx, s);
      const supp = await accessOf(ctx, sup);
      expect(hasPermission(admin, "settings.manage")).toBe(true);
      expect(isAdmin(admin)).toBe(true);
      expect(isAdmin(seller)).toBe(false);
      expect(hasPermission(supp, "users.view")).toBe(true);
      expect(hasPermission(supp, "users.suspend")).toBe(false);
      expect(isAdmin(supp)).toBe(true);
    });
  });
});

describe("assertCanChangeUser", () => {
  test("nobody changes themselves", async () => {
    const t = setup();
    const ids = await builtInRoles(t);
    const a = await insertUserWithRole(t, "a@x.com", ids.super_admin);
    await insertUserWithRole(t, "b@x.com", ids.super_admin);
    await t.run(async (ctx) => {
      const access = await accessOf(ctx, a);
      await expect(assertCanChangeUser(ctx, access, access.user, { active: false })).rejects.toThrow(
        /CANNOT_MODIFY_SELF/,
      );
    });
  });

  test("the last active super admin can't be demoted or suspended", async () => {
    const t = setup();
    const ids = await builtInRoles(t);
    const a = await insertUserWithRole(t, "a@x.com", ids.super_admin);
    const c = await insertUserWithRole(t, "c@x.com", ids.super_admin);
    // A suspended super admin doesn't count as a remaining one.
    await insertUserWithRole(t, "b@x.com", ids.super_admin, "suspended");
    await t.run(async (ctx) => {
      const actor = await accessOf(ctx, a);
      const seller = (await ctx.db.get("roles", ids.seller))!;
      const target = (await ctx.db.get("users", c))!;
      // Two active super admins: demoting one is fine.
      await expect(assertCanChangeUser(ctx, actor, target, { role: seller })).resolves.toBeUndefined();

      // Only `c` left active. Normally only another active super admin can act
      // on a super admin, so this rule is defence in depth: simulate an actor
      // who passed the other checks.
      await ctx.db.patch("users", a, { status: "suspended" });
      await expect(assertCanChangeUser(ctx, actor, target, { role: seller })).rejects.toThrow(
        /LAST_SUPER_ADMIN/,
      );
      await expect(assertCanChangeUser(ctx, actor, target, { active: false })).rejects.toThrow(
        /LAST_SUPER_ADMIN/,
      );
    });
  });

  test("only a super admin can touch a super admin or grant the role", async () => {
    const t = setup();
    const ids = await builtInRoles(t);
    const mod = await insertRole(t, "Moderator", ["users.view", "users.suspend", "users.assignRole"]);
    const m = await insertUserWithRole(t, "m@x.com", mod);
    const sa = await insertUserWithRole(t, "sa@x.com", ids.super_admin);
    const s = await insertUserWithRole(t, "s@x.com", ids.seller);
    await t.run(async (ctx) => {
      const access = await accessOf(ctx, m);
      const superAdmin = (await ctx.db.get("users", sa))!;
      const seller = (await ctx.db.get("users", s))!;
      const saRole = (await ctx.db.get("roles", ids.super_admin))!;
      await expect(assertCanChangeUser(ctx, access, superAdmin, { active: false })).rejects.toThrow(/FORBIDDEN/);
      await expect(assertCanChangeUser(ctx, access, seller, { role: saRole })).rejects.toThrow(/FORBIDDEN/);
      await expect(assertCanChangeUser(ctx, access, seller, { active: false })).resolves.toBeUndefined();
    });
  });

  test("no escalation: can't assign a role with more permissions than yours", async () => {
    const t = setup();
    await builtInRoles(t);
    const mod = await insertRole(t, "Moderator", ["users.view", "users.assignRole"]);
    const big = await insertRole(t, "Big", ["users.view", "shops.delete"]);
    const small = await insertRole(t, "Small", ["users.view"]);
    const m = await insertUserWithRole(t, "m@x.com", mod);
    const target = await insertUserWithRole(t, "t@x.com", small);
    await t.run(async (ctx) => {
      const access = await accessOf(ctx, m);
      const user = (await ctx.db.get("users", target))!;
      const bigRole = (await ctx.db.get("roles", big))!;
      const smallRole = (await ctx.db.get("roles", small))!;
      await expect(assertCanChangeUser(ctx, access, user, { role: bigRole })).rejects.toThrow(
        /PERMISSION_ESCALATION/,
      );
      await expect(assertCanChangeUser(ctx, access, user, { role: smallRole })).resolves.toBeUndefined();
    });
  });
});

describe("role guards", () => {
  test("built-in roles can't be written or deleted", async () => {
    const t = setup();
    const ids = await builtInRoles(t);
    const a = await insertUserWithRole(t, "a@x.com", ids.super_admin);
    await t.run(async (ctx) => {
      const access = await accessOf(ctx, a);
      const seller = (await ctx.db.get("roles", ids.seller))!;
      expect(() => assertCanWriteRole(access, seller, [])).toThrow(/ROLE_BUILT_IN/);
      await expect(assertCanDeleteRole(ctx, access, seller)).rejects.toThrow(/ROLE_BUILT_IN/);
    });
  });

  test("can't grant permissions you don't hold or edit your own role", async () => {
    const t = setup();
    await builtInRoles(t);
    const rm = await insertRole(t, "Role manager", ["roles.view", "roles.manage", "users.view"]);
    const other = await insertRole(t, "Other", ["users.view"]);
    const u = await insertUserWithRole(t, "u@x.com", rm);
    await t.run(async (ctx) => {
      const access = await accessOf(ctx, u);
      const own = (await ctx.db.get("roles", rm))!;
      const otherRole = (await ctx.db.get("roles", other))!;
      expect(() => assertCanWriteRole(access, null, cleanPermissions(["shops.delete"]))).toThrow(
        /PERMISSION_ESCALATION/,
      );
      expect(() => assertCanWriteRole(access, own, ["users.view"])).toThrow(/CANNOT_MODIFY_SELF/);
      expect(() => assertCanWriteRole(access, otherRole, ["users.view"])).not.toThrow();
    });
  });

  test("a role in use can't be deleted", async () => {
    const t = setup();
    const ids = await builtInRoles(t);
    const support = await insertRole(t, "Support", ["users.view"]);
    const unused = await insertRole(t, "Unused", ["users.view"]);
    const a = await insertUserWithRole(t, "a@x.com", ids.super_admin);
    await insertUserWithRole(t, "s@x.com", support, "suspended");
    await t.run(async (ctx) => {
      await ensureBuiltInRoles(ctx);
      const access = await accessOf(ctx, a);
      await expect(assertCanDeleteRole(ctx, access, (await ctx.db.get("roles", support))!)).rejects.toThrow(
        /ROLE_IN_USE/,
      );
      await expect(assertCanDeleteRole(ctx, access, (await ctx.db.get("roles", unused))!)).resolves.toBeUndefined();
    });
  });
});
