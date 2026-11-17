/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin_dashboard from "../admin/dashboard.js";
import type * as admin_products from "../admin/products.js";
import type * as admin_roles from "../admin/roles.js";
import type * as admin_shops from "../admin/shops.js";
import type * as admin_users from "../admin/users.js";
import type * as auth from "../auth.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_accounts from "../lib/accounts.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_catalog from "../lib/catalog.js";
import type * as lib_credentials from "../lib/credentials.js";
import type * as lib_days from "../lib/days.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_guards from "../lib/guards.js";
import type * as lib_images from "../lib/images.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_phone from "../lib/phone.js";
import type * as lib_platformStats from "../lib/platformStats.js";
import type * as lib_productWrites from "../lib/productWrites.js";
import type * as lib_roles from "../lib/roles.js";
import type * as lib_seller from "../lib/seller.js";
import type * as lib_slug from "../lib/slug.js";
import type * as migrations from "../migrations.js";
import type * as products from "../products.js";
import type * as public_ from "../public.js";
import type * as seed from "../seed.js";
import type * as shops from "../shops.js";
import type * as stats from "../stats.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "admin/dashboard": typeof admin_dashboard;
  "admin/products": typeof admin_products;
  "admin/roles": typeof admin_roles;
  "admin/shops": typeof admin_shops;
  "admin/users": typeof admin_users;
  auth: typeof auth;
  files: typeof files;
  http: typeof http;
  "lib/access": typeof lib_access;
  "lib/accounts": typeof lib_accounts;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/catalog": typeof lib_catalog;
  "lib/credentials": typeof lib_credentials;
  "lib/days": typeof lib_days;
  "lib/errors": typeof lib_errors;
  "lib/guards": typeof lib_guards;
  "lib/images": typeof lib_images;
  "lib/money": typeof lib_money;
  "lib/permissions": typeof lib_permissions;
  "lib/phone": typeof lib_phone;
  "lib/platformStats": typeof lib_platformStats;
  "lib/productWrites": typeof lib_productWrites;
  "lib/roles": typeof lib_roles;
  "lib/seller": typeof lib_seller;
  "lib/slug": typeof lib_slug;
  migrations: typeof migrations;
  products: typeof products;
  public: typeof public_;
  seed: typeof seed;
  shops: typeof shops;
  stats: typeof stats;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  usersByCreation: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"usersByCreation">;
  shopsByCreation: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"shopsByCreation">;
  productsByCreation: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"productsByCreation">;
  clicksByDay: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"clicksByDay">;
};
