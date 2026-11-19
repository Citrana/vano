/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin_attention from "../admin/attention.js";
import type * as admin_audit from "../admin/audit.js";
import type * as admin_billing from "../admin/billing.js";
import type * as admin_changeRequests from "../admin/changeRequests.js";
import type * as admin_dashboard from "../admin/dashboard.js";
import type * as admin_products from "../admin/products.js";
import type * as admin_roles from "../admin/roles.js";
import type * as admin_settings from "../admin/settings.js";
import type * as admin_shops from "../admin/shops.js";
import type * as admin_users from "../admin/users.js";
import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as billingJobs from "../billingJobs.js";
import type * as changeRequestJobs from "../changeRequestJobs.js";
import type * as changeRequests from "../changeRequests.js";
import type * as crons from "../crons.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_accounts from "../lib/accounts.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_catalog from "../lib/catalog.js";
import type * as lib_changeRequests from "../lib/changeRequests.js";
import type * as lib_credentials from "../lib/credentials.js";
import type * as lib_days from "../lib/days.js";
import type * as lib_entitlements from "../lib/entitlements.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_guards from "../lib/guards.js";
import type * as lib_images from "../lib/images.js";
import type * as lib_listOrder from "../lib/listOrder.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_notify from "../lib/notify.js";
import type * as lib_onboarding from "../lib/onboarding.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_phone from "../lib/phone.js";
import type * as lib_plans from "../lib/plans.js";
import type * as lib_platformStats from "../lib/platformStats.js";
import type * as lib_productWrites from "../lib/productWrites.js";
import type * as lib_protectedNames from "../lib/protectedNames.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_roles from "../lib/roles.js";
import type * as lib_seller from "../lib/seller.js";
import type * as lib_settings from "../lib/settings.js";
import type * as lib_shopChanges from "../lib/shopChanges.js";
import type * as lib_slug from "../lib/slug.js";
import type * as lib_subscriptions from "../lib/subscriptions.js";
import type * as lib_themes from "../lib/themes.js";
import type * as migrations from "../migrations.js";
import type * as notificationJobs from "../notificationJobs.js";
import type * as notifications_channel from "../notifications/channel.js";
import type * as notifications_config from "../notifications/config.js";
import type * as notifications_deliver from "../notifications/deliver.js";
import type * as notifications_inbox from "../notifications/inbox.js";
import type * as notifications_kinds from "../notifications/kinds.js";
import type * as notifications_log from "../notifications/log.js";
import type * as notifications_registry from "../notifications/registry.js";
import type * as notifications_types from "../notifications/types.js";
import type * as payments_core from "../payments/core.js";
import type * as payments_mock from "../payments/mock.js";
import type * as payments_provider from "../payments/provider.js";
import type * as payments_registry from "../payments/registry.js";
import type * as payments_types from "../payments/types.js";
import type * as products from "../products.js";
import type * as public_ from "../public.js";
import type * as seed from "../seed.js";
import type * as shops from "../shops.js";
import type * as stats from "../stats.js";
import type * as users from "../users.js";
import type * as verification_codes from "../verification/codes.js";
import type * as verification_deliver from "../verification/deliver.js";
import type * as verification_log from "../verification/log.js";
import type * as verification_registry from "../verification/registry.js";
import type * as verification_sender from "../verification/sender.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "admin/attention": typeof admin_attention;
  "admin/audit": typeof admin_audit;
  "admin/billing": typeof admin_billing;
  "admin/changeRequests": typeof admin_changeRequests;
  "admin/dashboard": typeof admin_dashboard;
  "admin/products": typeof admin_products;
  "admin/roles": typeof admin_roles;
  "admin/settings": typeof admin_settings;
  "admin/shops": typeof admin_shops;
  "admin/users": typeof admin_users;
  auth: typeof auth;
  billing: typeof billing;
  billingJobs: typeof billingJobs;
  changeRequestJobs: typeof changeRequestJobs;
  changeRequests: typeof changeRequests;
  crons: typeof crons;
  files: typeof files;
  http: typeof http;
  "lib/access": typeof lib_access;
  "lib/accounts": typeof lib_accounts;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/catalog": typeof lib_catalog;
  "lib/changeRequests": typeof lib_changeRequests;
  "lib/credentials": typeof lib_credentials;
  "lib/days": typeof lib_days;
  "lib/entitlements": typeof lib_entitlements;
  "lib/errors": typeof lib_errors;
  "lib/guards": typeof lib_guards;
  "lib/images": typeof lib_images;
  "lib/listOrder": typeof lib_listOrder;
  "lib/money": typeof lib_money;
  "lib/notify": typeof lib_notify;
  "lib/onboarding": typeof lib_onboarding;
  "lib/permissions": typeof lib_permissions;
  "lib/phone": typeof lib_phone;
  "lib/plans": typeof lib_plans;
  "lib/platformStats": typeof lib_platformStats;
  "lib/productWrites": typeof lib_productWrites;
  "lib/protectedNames": typeof lib_protectedNames;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/roles": typeof lib_roles;
  "lib/seller": typeof lib_seller;
  "lib/settings": typeof lib_settings;
  "lib/shopChanges": typeof lib_shopChanges;
  "lib/slug": typeof lib_slug;
  "lib/subscriptions": typeof lib_subscriptions;
  "lib/themes": typeof lib_themes;
  migrations: typeof migrations;
  notificationJobs: typeof notificationJobs;
  "notifications/channel": typeof notifications_channel;
  "notifications/config": typeof notifications_config;
  "notifications/deliver": typeof notifications_deliver;
  "notifications/inbox": typeof notifications_inbox;
  "notifications/kinds": typeof notifications_kinds;
  "notifications/log": typeof notifications_log;
  "notifications/registry": typeof notifications_registry;
  "notifications/types": typeof notifications_types;
  "payments/core": typeof payments_core;
  "payments/mock": typeof payments_mock;
  "payments/provider": typeof payments_provider;
  "payments/registry": typeof payments_registry;
  "payments/types": typeof payments_types;
  products: typeof products;
  public: typeof public_;
  seed: typeof seed;
  shops: typeof shops;
  stats: typeof stats;
  users: typeof users;
  "verification/codes": typeof verification_codes;
  "verification/deliver": typeof verification_deliver;
  "verification/log": typeof verification_log;
  "verification/registry": typeof verification_registry;
  "verification/sender": typeof verification_sender;
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
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
