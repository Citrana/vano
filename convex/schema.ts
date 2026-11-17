import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { auditActionValidator, auditDetailsValidator, auditTargetTypeValidator } from "./lib/audit";
import { categoryValidator, languageValidator } from "./lib/catalog";
import { currencyValidator } from "./lib/money";
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
    /** Optional until `migrations:rbacV1`; missing = active. */
    status: v.optional(shopStatusValidator),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_slug", ["slug"]),

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
  })
    .index("by_shopId", ["shopId"])
    .index("by_shopId_and_category", ["shopId", "category"]),

  /**
   * Who uploaded each storage file. A file is claimed by the first seller
   * who attaches it, so nobody can attach (and later delete) someone
   * else's image.
   */
  uploads: defineTable({
    storageId: v.id("_storage"),
    ownerId: v.id("users"),
  }).index("by_storageId", ["storageId"]),

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
