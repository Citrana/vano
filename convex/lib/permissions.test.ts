import { describe, expect, test } from "vitest";
import {
  ADMIN_PERMISSIONS,
  ALL_PERMISSIONS,
  cleanPermissions,
  isPermission,
  PERMISSION_GROUPS,
  roleNameProblem,
  SELLER_PERMISSIONS,
} from "./permissions";

describe("permissions", () => {
  test("every permission is <area>.<action> from the groups", () => {
    const count = Object.values(PERMISSION_GROUPS).reduce((n, a) => n + a.length, 0);
    expect(ALL_PERMISSIONS).toHaveLength(count);
    expect(new Set(ALL_PERMISSIONS).size).toBe(count);
    expect(ALL_PERMISSIONS).toContain("users.suspend");
  });

  test("seller and admin sets split the list", () => {
    expect(SELLER_PERMISSIONS).toEqual(["ownShop.manage", "ownProducts.manage", "ownStats.view", "ownBilling.manage"]);
    expect([...ADMIN_PERMISSIONS, ...SELLER_PERMISSIONS].sort()).toEqual([...ALL_PERMISSIONS].sort());
    expect(ADMIN_PERMISSIONS.some((p) => p.startsWith("own"))).toBe(false);
  });

  test("cleanPermissions drops unknown values and duplicates", () => {
    expect(cleanPermissions(["users.view", "nope.do", "users.view"])).toEqual(["users.view"]);
    expect(isPermission("roles.manage")).toBe(true);
    expect(isPermission("roles.destroy")).toBe(false);
  });

  test("roleNameProblem", () => {
    expect(roleNameProblem("Support")).toBeNull();
    expect(roleNameProblem(" a ")).toBe("length");
    expect(roleNameProblem("x".repeat(41))).toBe("length");
  });
});
