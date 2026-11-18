import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { auditActionValidator, auditDetailsValidator, auditTargetTypeValidator } from "./lib/audit";
import { categoryValidator, languageValidator } from "./lib/catalog";
import { currencyValidator } from "./lib/money";
import { shopThemeValidator } from "./lib/themes";
import {
  nextActionValidator,
  paymentOutcomeValidator,
  paymentStatusValidator,
  providerIdValidator,
} from "./payments/types";
import {
  planIdValidator,
  subscriptionSourceValidator,
  subscriptionStatusValidator,
} from "./lib/plans";
import {
  permissionValidator,
  roleKeyValidator,
  shopStatusValidator,
  userStatusValidator,
} from "./lib/permissions";

export default defineSchema({
  ...authTables,

  /**
   * Convex Auth's users table plus role and status. `roleId` / `status`
   * stay optional until `migrations:rbacV1` has run everywhere: until then
   * a missing role counts as seller and a missing status as active
   * (`convex/lib/access.ts`).
   */
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    roleId: v.optional(v.id("roles")),
    status: v.optional(userStatusValidator),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_roleId_and_status", ["roleId", "status"])
    .index("by_status", ["status"])
    .searchIndex("search_email", { searchField: "email", filterFields: ["roleId", "status"] }),

  /**
   * Built-in roles have a `key`. Super admin permissions are never stored
   * (it has all of them); seller permissions are fixed in code.
   */
  roles: defineTable({
    name: v.string(),
    key: v.optional(roleKeyValidator),
    description: v.optional(v.string()),
    permissions: v.array(permissionValidator),
  })
    .index("by_key", ["key"])
    .index("by_name", ["name"]),

  /** Admin action history. `_creationTime` is when it happened. */
  auditLogs: defineTable({
    /** Absent for the terminal seed command. */
    actorId: v.optional(v.id("users")),
    actorEmail: v.string(),
    action: auditActionValidator,
    targetType: auditTargetTypeValidator,
    targetId: v.string(),
    targetLabel: v.string(),
    details: v.optional(auditDetailsValidator),
  })
    .index("by_actorId", ["actorId"])
    .index("by_action", ["action"])
    .index("by_actorId_and_action", ["actorId", "action"]),

  shops: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    slug: v.string(),
    currency: currencyValidator,
    language: languageValidator,
    categories: v.array(categoryValidator),
    description: v.optional(v.string()),
    /** E.164, e.g. "+243812345678". */
    whatsappNumber: v.string(),
    city: v.string(),
    /** ISO 3166-1 alpha-2, e.g. "CD". */
    country: v.string(),
    logoId: v.optional(v.id("_storage")),
    /** The shop look picked in settings; missing = not picked yet. */
    theme: v.optional(shopThemeValidator),
    /** Dashboard checklist progress the seller can't derive from data. */
    onboarding: v.optional(
      v.object({
        linkSharedAt: v.optional(v.number()),
        checklistHiddenAt: v.optional(v.number()),
      }),
    ),
    /** Optional until `migrations:rbacV1`; missing = active. */
    status: v.optional(shopStatusValidator),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_slug", ["slug"])
    .index("by_status_and_currency", ["status", "currency"])
    .index("by_currency", ["currency"])
    .searchIndex("search_name", { searchField: "name", filterFields: ["status", "currency"] }),

  products: defineTable({
    shopId: v.id("shops"),
    name: v.string(),
    /** Integer minor units, in the shop's currency. */
    price: v.number(),
    category: categoryValidator,
    description: v.optional(v.string()),
    sizes: v.array(v.string()),
    colors: v.array(v.string()),
    /** 1–6 images; the first one is the cover. */
    imageIds: v.array(v.id("_storage")),
    soldOut: v.boolean(),
    updatedAt: v.number(),
    /** Hidden by an admin. Optional until `migrations:rbacV1`; missing = visible. */
    hidden: v.optional(v.boolean()),
    /**
     * Set when the seller chose to keep this product visible while the shop
     * is over its plan's product limit (CLAUDE.md "Billing").
     */
    pinnedAt: v.optional(v.number()),
  })
    .index("by_shopId", ["shopId"])
    .index("by_shopId_and_category", ["shopId", "category"])
    .index("by_hidden_and_category", ["hidden", "category"])
    .index("by_category", ["category"])
    .searchIndex("search_name", { searchField: "name", filterFields: ["hidden", "category"] }),

  /**
   * Who uploaded each storage file. A file is claimed by the first seller
   * who attaches it, so nobody can attach (and later delete) someone
   * else's image.
   */
  uploads: defineTable({
    storageId: v.id("_storage"),
    ownerId: v.id("users"),
  }).index("by_storageId", ["storageId"]),

  /** Platform settings: a single document (see convex/lib/settings.ts). */
  platformSettings: defineTable({
    signupEnabled: v.boolean(),
    announcement: v.optional(v.object({ en: v.string(), fr: v.string() })),
  }),

  /**
   * One-time permission for the terminal seed command to create an
   * account while public sign-up is closed (created by internal code only).
   */
  signupBypasses: defineTable({
    email: v.string(),
    expiresAt: v.number(),
  }).index("by_email", ["email"]),

  /** One row per one-time data migration (e.g. "rbacV1"). */
  migrations: defineTable({
    name: v.string(),
    status: v.union(v.literal("running"), v.literal("done")),
    startedAt: v.number(),
    doneAt: v.optional(v.number()),
  }).index("by_name", ["name"]),

  /**
   * One per shop (CLAUDE.md "Billing"). Written only through
   * convex/lib/subscriptions.ts. `periodEnd` is absent on Free.
   * `shopName` is a copy for admin search, kept in sync by `shops.update`.
   */
  subscriptions: defineTable({
    shopId: v.id("shops"),
    shopName: v.string(),
    plan: planIdValidator,
    status: subscriptionStatusValidator,
    periodStart: v.number(),
    periodEnd: v.optional(v.number()),
    source: subscriptionSourceValidator,
    updatedAt: v.number(),
  })
    .index("by_shopId", ["shopId"])
    .index("by_status_and_periodEnd", ["status", "periodEnd"])
    .index("by_plan_and_status_and_periodEnd", ["plan", "status", "periodEnd"])
    .index("by_plan_and_periodEnd", ["plan", "periodEnd"])
    .index("by_periodEnd", ["periodEnd"])
    .searchIndex("search_shopName", { searchField: "shopName", filterFields: ["plan", "status"] }),

  /**
   * Plan payments. The amount comes from convex/lib/plans.ts, never from
   * the client. Results from the provider are applied only by
   * `payments/core.applyResult`; `appliedAt` is set in the same transaction
   * that extends the plan, so a payment can never extend it twice.
   * `shopName` is a snapshot taken when the payment started.
   */
  payments: defineTable({
    shopId: v.id("shops"),
    shopName: v.string(),
    userId: v.id("users"),
    plan: planIdValidator,
    amountMinor: v.number(),
    currency: currencyValidator,
    provider: providerIdValidator,
    providerRef: v.optional(v.string()),
    /** Set once the provider accepted it (status → pending). */
    next: v.optional(nextActionValidator),
    status: paymentStatusValidator,
    /** The provider said "still processing" (e.g. waiting for the bank). */
    pendingReportedAt: v.optional(v.number()),
    failureCode: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    appliedAt: v.optional(v.number()),
    periodEndAfter: v.optional(v.number()),
  })
    .index("by_shopId", ["shopId"])
    .index("by_shopId_and_status", ["shopId", "status"])
    .index("by_provider_and_providerRef", ["provider", "providerRef"])
    .index("by_status", ["status"])
    .index("by_plan", ["plan"])
    .index("by_plan_and_status", ["plan", "status"])
    .searchIndex("search_shopName", { searchField: "shopName", filterFields: ["plan", "status"] }),

  /** Every result received from a payment provider, deduplicated by event id. */
  paymentEvents: defineTable({
    provider: providerIdValidator,
    eventId: v.string(),
    paymentId: v.id("payments"),
    outcome: paymentOutcomeValidator,
    receivedAt: v.number(),
  })
    .index("by_provider_and_eventId", ["provider", "eventId"])
    .index("by_paymentId", ["paymentId"]),

  /** Per shop per UTC day. No personal data. */
  shopDailyStats: defineTable({
    shopId: v.id("shops"),
    day: v.string(),
    shopViews: v.number(),
    productViews: v.number(),
    whatsappClicks: v.number(),
  }).index("by_shopId_and_day", ["shopId", "day"]),

  /** Per product per UTC day. No personal data. */
  productDailyStats: defineTable({
    shopId: v.id("shops"),
    productId: v.id("products"),
    day: v.string(),
    views: v.number(),
    whatsappClicks: v.number(),
  })
    .index("by_productId_and_day", ["productId", "day"])
    .index("by_shopId_and_day", ["shopId", "day"]),
});
