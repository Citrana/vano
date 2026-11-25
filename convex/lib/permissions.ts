import { v } from "convex/values";

/**
 * The one list of permissions (CLAUDE.md "Roles & permissions"). A
 * permission is "<area>.<action>". The admin role editor builds its
 * checkbox grid from `PERMISSION_GROUPS`, and labels come from
 * `Permissions.<area>.<action>` in `messages/*.json`.
 *
 * Adding a permission: add it here (+ both translations). Super admins get
 * it automatically; no other role does until someone grants it.
 */
export const PERMISSION_GROUPS = {
  dashboard: ["view"],
  users: ["view", "suspend", "assignRole"],
  /**
   * resetLook: reset a shop's look (banner photo / text, or all) to a safe default.
   * manageSales: pause or delete a shop's sale, with a reason.
   * manageDiscountCodes: pause or delete a shop's discount code, with a reason.
   */
  shops: ["view", "suspend", "delete", "resetLook", "manageSales", "manageDiscountCodes"],
  products: ["view", "hide", "delete"],
  roles: ["view", "manage"],
  audit: ["view"],
  settings: ["view", "manage"],
  /** Subscriptions and payments: view them; grant or extend plans. */
  billing: ["view", "manage"],
  /** Plans & features: plan prices, which plan gets which feature, limits, shop exceptions. */
  plans: ["manage"],
  /** Requests to change a shop's name, link or WhatsApp: see them; approve or reject. */
  changeRequests: ["view", "decide"],
  /** The seller's own shop — always combined with the ownership checks. */
  ownShop: ["manage"],
  ownProducts: ["manage"],
  ownStats: ["view"],
  /** Their own shop's plan, checkout and payment history. */
  ownBilling: ["manage"],
} as const satisfies Record<string, readonly string[]>;

type Groups = typeof PERMISSION_GROUPS;
export type PermissionArea = keyof Groups;
export type Permission = {
  [A in PermissionArea]: `${A}.${Groups[A][number]}`;
}[PermissionArea];

export const PERMISSION_AREAS = Object.keys(PERMISSION_GROUPS) as PermissionArea[];

export const ALL_PERMISSIONS: readonly Permission[] = PERMISSION_AREAS.flatMap((area) =>
  PERMISSION_GROUPS[area].map((action) => `${area}.${action}` as Permission),
);

const SELLER_AREAS: readonly PermissionArea[] = ["ownShop", "ownProducts", "ownStats", "ownBilling"];

/** Areas of the seller's own shop; everything else is an admin area. */
export function isSellerArea(area: PermissionArea): boolean {
  return SELLER_AREAS.includes(area);
}

export function areaOf(permission: Permission): PermissionArea {
  return permission.split(".")[0] as PermissionArea;
}

/** Fixed in code so a mis-click in the admin can't lock out every seller. */
export const SELLER_PERMISSIONS: readonly Permission[] = ALL_PERMISSIONS.filter((p) =>
  isSellerArea(areaOf(p)),
);

/** Holding any of these opens /admin. */
export const ADMIN_PERMISSIONS: readonly Permission[] = ALL_PERMISSIONS.filter(
  (p) => !isSellerArea(areaOf(p)),
);

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Stored role permissions are plain strings, so a permission removed from
 * the list later is simply ignored instead of breaking the role.
 */
export const permissionValidator = v.string();

/** Keeps known permissions, drops unknown ones and duplicates. */
export function cleanPermissions(values: readonly string[]): Permission[] {
  return ALL_PERMISSIONS.filter((p) => values.includes(p));
}

export const BUILT_IN_ROLE_KEYS = ["super_admin", "seller"] as const;
export type BuiltInRoleKey = (typeof BUILT_IN_ROLE_KEYS)[number];
export const roleKeyValidator = v.union(v.literal("super_admin"), v.literal("seller"));

export const ROLE_NAME_MIN = 2;
export const ROLE_NAME_MAX = 40;
export const ROLE_DESCRIPTION_MAX = 200;

export function roleNameProblem(name: string): "length" | null {
  const trimmed = name.trim();
  return trimmed.length < ROLE_NAME_MIN || trimmed.length > ROLE_NAME_MAX ? "length" : null;
}

export const userStatusValidator = v.union(v.literal("active"), v.literal("suspended"));
export const shopStatusValidator = v.union(v.literal("active"), v.literal("suspended"));
