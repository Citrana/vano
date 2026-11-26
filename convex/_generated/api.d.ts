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
import type * as admin_discountCodes from "../admin/discountCodes.js";
import type * as admin_emails from "../admin/emails.js";
import type * as admin_planExceptions from "../admin/planExceptions.js";
import type * as admin_plans from "../admin/plans.js";
import type * as admin_products from "../admin/products.js";
import type * as admin_roles from "../admin/roles.js";
import type * as admin_sales from "../admin/sales.js";
import type * as admin_salesRecords from "../admin/salesRecords.js";
import type * as admin_settings from "../admin/settings.js";
import type * as admin_shopLooks from "../admin/shopLooks.js";
import type * as admin_shops from "../admin/shops.js";
import type * as admin_users from "../admin/users.js";
import type * as auth from "../auth.js";
import type * as authCodeJobs from "../authCodeJobs.js";
import type * as billing from "../billing.js";
import type * as billingJobs from "../billingJobs.js";
import type * as changeRequestJobs from "../changeRequestJobs.js";
import type * as changeRequests from "../changeRequests.js";
import type * as crons from "../crons.js";
import type * as discountCodeJobs from "../discountCodeJobs.js";
import type * as discountCodes from "../discountCodes.js";
import type * as emails_address from "../emails/address.js";
import type * as emails_authCode from "../emails/authCode.js";
import type * as emails_config from "../emails/config.js";
import type * as emails_layout from "../emails/layout.js";
import type * as emails_log from "../emails/log.js";
import type * as emails_provider from "../emails/provider.js";
import type * as emails_registry from "../emails/registry.js";
import type * as emails_resend from "../emails/resend.js";
import type * as emails_send from "../emails/send.js";
import type * as emails_templates_authCode from "../emails/templates/authCode.js";
import type * as emails_templates_test from "../emails/templates/test.js";
import type * as emails_templates_welcome from "../emails/templates/welcome.js";
import type * as emails_texts from "../emails/texts.js";
import type * as emails_welcome from "../emails/welcome.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_accounts from "../lib/accounts.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_authCodes from "../lib/authCodes.js";
import type * as lib_authFlows from "../lib/authFlows.js";
import type * as lib_catalog from "../lib/catalog.js";
import type * as lib_changeRequests from "../lib/changeRequests.js";
import type * as lib_colorSwatches from "../lib/colorSwatches.js";
import type * as lib_credentials from "../lib/credentials.js";
import type * as lib_days from "../lib/days.js";
import type * as lib_discountCodes_active from "../lib/discountCodes/active.js";
import type * as lib_discountCodes_code from "../lib/discountCodes/code.js";
import type * as lib_discountCodes_rules from "../lib/discountCodes/rules.js";
import type * as lib_discountCodes_store from "../lib/discountCodes/store.js";
import type * as lib_discountCodes_validators from "../lib/discountCodes/validators.js";
import type * as lib_downgradeImpact from "../lib/downgradeImpact.js";
import type * as lib_entitlements from "../lib/entitlements.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_guards from "../lib/guards.js";
import type * as lib_images from "../lib/images.js";
import type * as lib_listOrder from "../lib/listOrder.js";
import type * as lib_looks_announcement from "../lib/looks/announcement.js";
import type * as lib_looks_banners from "../lib/looks/banners.js";
import type * as lib_looks_buttonDesigns from "../lib/looks/buttonDesigns.js";
import type * as lib_looks_clean from "../lib/looks/clean.js";
import type * as lib_looks_color from "../lib/looks/color.js";
import type * as lib_looks_contrast from "../lib/looks/contrast.js";
import type * as lib_looks_events from "../lib/looks/events.js";
import type * as lib_looks_filters from "../lib/looks/filters.js";
import type * as lib_looks_presets from "../lib/looks/presets.js";
import type * as lib_looks_profile from "../lib/looks/profile.js";
import type * as lib_looks_reset from "../lib/looks/reset.js";
import type * as lib_looks_resolve from "../lib/looks/resolve.js";
import type * as lib_looks_schedule from "../lib/looks/schedule.js";
import type * as lib_looks_sections from "../lib/looks/sections.js";
import type * as lib_looks_store from "../lib/looks/store.js";
import type * as lib_looks_validators from "../lib/looks/validators.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_notify from "../lib/notify.js";
import type * as lib_onboarding from "../lib/onboarding.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_phone from "../lib/phone.js";
import type * as lib_planCatalog from "../lib/planCatalog.js";
import type * as lib_planConfig from "../lib/planConfig.js";
import type * as lib_planDefaults from "../lib/planDefaults.js";
import type * as lib_planFeatures from "../lib/planFeatures.js";
import type * as lib_planValidators from "../lib/planValidators.js";
import type * as lib_plans from "../lib/plans.js";
import type * as lib_platformStats from "../lib/platformStats.js";
import type * as lib_productStock from "../lib/productStock.js";
import type * as lib_productWrites from "../lib/productWrites.js";
import type * as lib_protectedNames from "../lib/protectedNames.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_restock from "../lib/restock.js";
import type * as lib_roles from "../lib/roles.js";
import type * as lib_sales_active from "../lib/sales/active.js";
import type * as lib_sales_discount from "../lib/sales/discount.js";
import type * as lib_sales_rules from "../lib/sales/rules.js";
import type * as lib_sales_store from "../lib/sales/store.js";
import type * as lib_sales_validators from "../lib/sales/validators.js";
import type * as lib_salesRecords_pricing from "../lib/salesRecords/pricing.js";
import type * as lib_salesRecords_report from "../lib/salesRecords/report.js";
import type * as lib_salesRecords_rules from "../lib/salesRecords/rules.js";
import type * as lib_salesRecords_validators from "../lib/salesRecords/validators.js";
import type * as lib_seller from "../lib/seller.js";
import type * as lib_settings from "../lib/settings.js";
import type * as lib_shopChanges from "../lib/shopChanges.js";
import type * as lib_shopInfo from "../lib/shopInfo.js";
import type * as lib_slug from "../lib/slug.js";
import type * as lib_stock from "../lib/stock.js";
import type * as lib_subscriptions from "../lib/subscriptions.js";
import type * as lib_timeZone from "../lib/timeZone.js";
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
import type * as planExceptionJobs from "../planExceptionJobs.js";
import type * as plans from "../plans.js";
import type * as productJobs from "../productJobs.js";
import type * as products from "../products.js";
import type * as public_ from "../public.js";
import type * as reportJobs from "../reportJobs.js";
import type * as reports from "../reports.js";
import type * as saleJobs from "../saleJobs.js";
import type * as sales from "../sales.js";
import type * as salesRecords from "../salesRecords.js";
import type * as seed from "../seed.js";
import type * as shopLookJobs from "../shopLookJobs.js";
import type * as shopLooks from "../shopLooks.js";
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
  "admin/discountCodes": typeof admin_discountCodes;
  "admin/emails": typeof admin_emails;
  "admin/planExceptions": typeof admin_planExceptions;
  "admin/plans": typeof admin_plans;
  "admin/products": typeof admin_products;
  "admin/roles": typeof admin_roles;
  "admin/sales": typeof admin_sales;
  "admin/salesRecords": typeof admin_salesRecords;
  "admin/settings": typeof admin_settings;
  "admin/shopLooks": typeof admin_shopLooks;
  "admin/shops": typeof admin_shops;
  "admin/users": typeof admin_users;
  auth: typeof auth;
  authCodeJobs: typeof authCodeJobs;
  billing: typeof billing;
  billingJobs: typeof billingJobs;
  changeRequestJobs: typeof changeRequestJobs;
  changeRequests: typeof changeRequests;
  crons: typeof crons;
  discountCodeJobs: typeof discountCodeJobs;
  discountCodes: typeof discountCodes;
  "emails/address": typeof emails_address;
  "emails/authCode": typeof emails_authCode;
  "emails/config": typeof emails_config;
  "emails/layout": typeof emails_layout;
  "emails/log": typeof emails_log;
  "emails/provider": typeof emails_provider;
  "emails/registry": typeof emails_registry;
  "emails/resend": typeof emails_resend;
  "emails/send": typeof emails_send;
  "emails/templates/authCode": typeof emails_templates_authCode;
  "emails/templates/test": typeof emails_templates_test;
  "emails/templates/welcome": typeof emails_templates_welcome;
  "emails/texts": typeof emails_texts;
  "emails/welcome": typeof emails_welcome;
  files: typeof files;
  http: typeof http;
  "lib/access": typeof lib_access;
  "lib/accounts": typeof lib_accounts;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/authCodes": typeof lib_authCodes;
  "lib/authFlows": typeof lib_authFlows;
  "lib/catalog": typeof lib_catalog;
  "lib/changeRequests": typeof lib_changeRequests;
  "lib/colorSwatches": typeof lib_colorSwatches;
  "lib/credentials": typeof lib_credentials;
  "lib/days": typeof lib_days;
  "lib/discountCodes/active": typeof lib_discountCodes_active;
  "lib/discountCodes/code": typeof lib_discountCodes_code;
  "lib/discountCodes/rules": typeof lib_discountCodes_rules;
  "lib/discountCodes/store": typeof lib_discountCodes_store;
  "lib/discountCodes/validators": typeof lib_discountCodes_validators;
  "lib/downgradeImpact": typeof lib_downgradeImpact;
  "lib/entitlements": typeof lib_entitlements;
  "lib/errors": typeof lib_errors;
  "lib/guards": typeof lib_guards;
  "lib/images": typeof lib_images;
  "lib/listOrder": typeof lib_listOrder;
  "lib/looks/announcement": typeof lib_looks_announcement;
  "lib/looks/banners": typeof lib_looks_banners;
  "lib/looks/buttonDesigns": typeof lib_looks_buttonDesigns;
  "lib/looks/clean": typeof lib_looks_clean;
  "lib/looks/color": typeof lib_looks_color;
  "lib/looks/contrast": typeof lib_looks_contrast;
  "lib/looks/events": typeof lib_looks_events;
  "lib/looks/filters": typeof lib_looks_filters;
  "lib/looks/presets": typeof lib_looks_presets;
  "lib/looks/profile": typeof lib_looks_profile;
  "lib/looks/reset": typeof lib_looks_reset;
  "lib/looks/resolve": typeof lib_looks_resolve;
  "lib/looks/schedule": typeof lib_looks_schedule;
  "lib/looks/sections": typeof lib_looks_sections;
  "lib/looks/store": typeof lib_looks_store;
  "lib/looks/validators": typeof lib_looks_validators;
  "lib/money": typeof lib_money;
  "lib/notify": typeof lib_notify;
  "lib/onboarding": typeof lib_onboarding;
  "lib/permissions": typeof lib_permissions;
  "lib/phone": typeof lib_phone;
  "lib/planCatalog": typeof lib_planCatalog;
  "lib/planConfig": typeof lib_planConfig;
  "lib/planDefaults": typeof lib_planDefaults;
  "lib/planFeatures": typeof lib_planFeatures;
  "lib/planValidators": typeof lib_planValidators;
  "lib/plans": typeof lib_plans;
  "lib/platformStats": typeof lib_platformStats;
  "lib/productStock": typeof lib_productStock;
  "lib/productWrites": typeof lib_productWrites;
  "lib/protectedNames": typeof lib_protectedNames;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/restock": typeof lib_restock;
  "lib/roles": typeof lib_roles;
  "lib/sales/active": typeof lib_sales_active;
  "lib/sales/discount": typeof lib_sales_discount;
  "lib/sales/rules": typeof lib_sales_rules;
  "lib/sales/store": typeof lib_sales_store;
  "lib/sales/validators": typeof lib_sales_validators;
  "lib/salesRecords/pricing": typeof lib_salesRecords_pricing;
  "lib/salesRecords/report": typeof lib_salesRecords_report;
  "lib/salesRecords/rules": typeof lib_salesRecords_rules;
  "lib/salesRecords/validators": typeof lib_salesRecords_validators;
  "lib/seller": typeof lib_seller;
  "lib/settings": typeof lib_settings;
  "lib/shopChanges": typeof lib_shopChanges;
  "lib/shopInfo": typeof lib_shopInfo;
  "lib/slug": typeof lib_slug;
  "lib/stock": typeof lib_stock;
  "lib/subscriptions": typeof lib_subscriptions;
  "lib/timeZone": typeof lib_timeZone;
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
  planExceptionJobs: typeof planExceptionJobs;
  plans: typeof plans;
  productJobs: typeof productJobs;
  products: typeof products;
  public: typeof public_;
  reportJobs: typeof reportJobs;
  reports: typeof reports;
  saleJobs: typeof saleJobs;
  sales: typeof sales;
  salesRecords: typeof salesRecords;
  seed: typeof seed;
  shopLookJobs: typeof shopLookJobs;
  shopLooks: typeof shopLooks;
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
