/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_catalog from "../lib/catalog.js";
import type * as lib_days from "../lib/days.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_images from "../lib/images.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_phone from "../lib/phone.js";
import type * as lib_seller from "../lib/seller.js";
import type * as lib_slug from "../lib/slug.js";
import type * as products from "../products.js";
import type * as public_ from "../public.js";
import type * as shops from "../shops.js";
import type * as stats from "../stats.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  files: typeof files;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/catalog": typeof lib_catalog;
  "lib/days": typeof lib_days;
  "lib/errors": typeof lib_errors;
  "lib/images": typeof lib_images;
  "lib/money": typeof lib_money;
  "lib/phone": typeof lib_phone;
  "lib/seller": typeof lib_seller;
  "lib/slug": typeof lib_slug;
  products: typeof products;
  public: typeof public_;
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

export declare const components: {};
