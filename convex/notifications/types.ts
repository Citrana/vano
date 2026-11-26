import { v, type Infer } from "convex/values";
import { protectedFieldValidator } from "../lib/changeRequests";
import type { Permission } from "../lib/permissions";
import { addDays } from "../lib/days";
import { EXPIRY_WARNING_DAYS, planIdValidator } from "../lib/plans";
import { teamRoleValidator } from "../lib/team";

/**
 * Every in-app notification type (CLAUDE.md "Notifications"). Pure module:
 * the server validates and stores `data`, the UI words it in the viewer's
 * language (`Notifications.types.<type>`) and links it with
 * `notificationHref`. Links are computed, never stored.
 *
 * Adding a type: a data validator below (in `notificationDataValidator`),
 * its line in `NOTIFICATION_TYPES`, a case in `notificationHref`, the
 * texts in both message files, and an icon in the UI.
 */

export const notificationCategoryValidator = v.union(v.literal("changeRequests"), v.literal("billing"), v.literal("shop"));
export type NotificationCategory = Infer<typeof notificationCategoryValidator>;
export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = ["changeRequests", "billing", "shop"];

/** WhatsApp numbers are stored masked (`maskPhone`); names and links as is. */
const changeRequestSubmitted = v.object({
  type: v.literal("changeRequest.submitted"),
  requestId: v.id("shopChangeRequests"),
  shopName: v.string(),
  field: protectedFieldValidator,
});

const changeRequestFlagged = v.object({
  type: v.literal("changeRequest.flagged"),
  requestId: v.id("shopChangeRequests"),
  shopName: v.string(),
  field: protectedFieldValidator,
  value: v.string(),
  brand: v.string(),
});

const changeRequestApproved = v.object({
  type: v.literal("changeRequest.approved"),
  requestId: v.id("shopChangeRequests"),
  field: protectedFieldValidator,
  value: v.string(),
});

const changeRequestRejected = v.object({
  type: v.literal("changeRequest.rejected"),
  requestId: v.id("shopChangeRequests"),
  field: protectedFieldValidator,
  value: v.string(),
  reason: v.string(),
});

/** To the seller who paid. */
const paymentFailed = v.object({
  type: v.literal("payment.failed"),
  paymentId: v.id("payments"),
  plan: planIdValidator,
});

/** To billing admins. `amount` is a display label ("299.00 KES"). */
const adminPaymentFailed = v.object({
  type: v.literal("admin.paymentFailed"),
  paymentId: v.id("payments"),
  shopId: v.id("shops"),
  shopName: v.string(),
  plan: planIdValidator,
  amount: v.string(),
});

const planActivated = v.object({
  type: v.literal("plan.activated"),
  plan: planIdValidator,
  periodEnd: v.number(),
});

/** `trial`: the trial ended (vs a paid plan). */
const planExpired = v.object({
  type: v.literal("plan.expired"),
  plan: planIdValidator,
  trial: v.boolean(),
});

/** Days left are computed when shown, from `periodEnd`. */
const planEndingSoon = v.object({
  type: v.literal("plan.endingSoon"),
  plan: planIdValidator,
  trial: v.boolean(),
  periodEnd: v.number(),
});

/** The trial / plan ended; the shop keeps it until `graceEnd`, then moves to Free. */
const planInGrace = v.object({
  type: v.literal("plan.inGrace"),
  plan: planIdValidator,
  trial: v.boolean(),
  graceEnd: v.number(),
});

/** One-time note (migrations:trialProOnlyV1): the free trial includes Pro features only. */
const planTrialProOnly = v.object({ type: v.literal("plan.trialProOnly") });

/** Daily summary for billing admins. `day` is the UTC day it was counted. */
const adminEndingSoon = v.object({
  type: v.literal("admin.endingSoon"),
  count: v.number(),
  capped: v.boolean(),
  day: v.string(),
});

/** To the seller: an admin reset their shop look ("banner": photo / text only; "profile": profile photo options). */
const lookReset = v.object({
  type: v.literal("look.reset"),
  scope: v.union(v.literal("banner"), v.literal("profile"), v.literal("all")),
  reason: v.string(),
});

/** To the seller: their scheduled sale started / ends in a day / ended (CLAUDE.md "Sales"). */
const saleStarted = v.object({ type: v.literal("sale.started"), saleId: v.id("sales"), name: v.string() });
const saleEndingSoon = v.object({
  type: v.literal("sale.endingSoon"),
  saleId: v.id("sales"),
  name: v.string(),
  endsAt: v.number(),
});
const saleEnded = v.object({ type: v.literal("sale.ended"), saleId: v.id("sales"), name: v.string() });
/** A recorded sale took the product's last piece (lib/productStock.ts). The UI offers "Hide product". */
/** Last month's sales report is ready (reportJobs.monthly); `month` is "YYYY-MM" in the shop's zone. */
const reportReady = v.object({ type: v.literal("report.ready"), month: v.string() });
const productSoldOut = v.object({ type: v.literal("product.soldOut"), productId: v.id("products"), name: v.string() });

/** To the seller: an admin paused or deleted one of their sales. */
const saleAdminPaused = v.object({
  type: v.literal("sale.adminPaused"),
  saleId: v.id("sales"),
  name: v.string(),
  reason: v.string(),
});
const saleAdminDeleted = v.object({ type: v.literal("sale.adminDeleted"), name: v.string(), reason: v.string() });

/** To the seller: an admin paused or deleted one of their discount codes (CLAUDE.md "Discount codes"). */
const discountCodeAdminPaused = v.object({
  type: v.literal("discountCode.adminPaused"),
  codeId: v.id("discountCodes"),
  code: v.string(),
  reason: v.string(),
});
const discountCodeAdminDeleted = v.object({
  type: v.literal("discountCode.adminDeleted"),
  code: v.string(),
  reason: v.string(),
});

/** To the shop owner: someone accepted an invite (CLAUDE.md "Team accounts"). */
const teamMemberJoined = v.object({
  type: v.literal("team.memberJoined"),
  shopName: v.string(),
  member: v.string(),
  role: teamRoleValidator,
});

/** To a member: the owner changed their role, suspended, reactivated or removed them. */
const teamAccessChanged = v.object({
  type: v.literal("team.accessChanged"),
  shopName: v.string(),
  change: v.union(v.literal("role"), v.literal("suspended"), v.literal("reactivated"), v.literal("removed")),
  role: v.optional(teamRoleValidator),
});

export const notificationDataValidator = v.union(
  teamMemberJoined,
  teamAccessChanged,
  changeRequestSubmitted,
  changeRequestFlagged,
  changeRequestApproved,
  changeRequestRejected,
  paymentFailed,
  adminPaymentFailed,
  planActivated,
  planExpired,
  planEndingSoon,
  planInGrace,
  planTrialProOnly,
  adminEndingSoon,
  lookReset,
  saleStarted,
  saleEndingSoon,
  saleEnded,
  saleAdminPaused,
  saleAdminDeleted,
  discountCodeAdminPaused,
  discountCodeAdminDeleted,
  productSoldOut,
  reportReady,
);
export type NotificationData = Infer<typeof notificationDataValidator>;
export type NotificationType = NotificationData["type"];

type TypeInfo = {
  category: NotificationCategory;
  /**
   * Who it's for: "user" = one person (the seller concerned); a permission
   * = everyone holding it, checked again on every read.
   */
  audience: "user" | Permission;
  /**
   * Shop types sent to the shop's team (`to: { shop }` in `notify`): the
   * owner and every usable member whose team role has this permission.
   * Checked again on every read against the reader's access to that shop.
   */
  shopPermission?: Permission;
};

export const NOTIFICATION_TYPES: Record<NotificationType, TypeInfo> = {
  "changeRequest.submitted": { category: "changeRequests", audience: "changeRequests.view" },
  "changeRequest.flagged": { category: "changeRequests", audience: "changeRequests.view" },
  "changeRequest.approved": { category: "changeRequests", audience: "user" },
  "changeRequest.rejected": { category: "changeRequests", audience: "user" },
  "payment.failed": { category: "billing", audience: "user" },
  "admin.paymentFailed": { category: "billing", audience: "billing.view" },
  "plan.activated": { category: "billing", audience: "user" },
  "plan.expired": { category: "billing", audience: "user" },
  "plan.endingSoon": { category: "billing", audience: "user" },
  "plan.inGrace": { category: "billing", audience: "user" },
  "plan.trialProOnly": { category: "billing", audience: "user" },
  "admin.endingSoon": { category: "billing", audience: "billing.view" },
  "look.reset": { category: "shop", audience: "user", shopPermission: "ownLook.manage" },
  "sale.started": { category: "shop", audience: "user", shopPermission: "ownOffers.manage" },
  "sale.endingSoon": { category: "shop", audience: "user", shopPermission: "ownOffers.manage" },
  "sale.ended": { category: "shop", audience: "user", shopPermission: "ownOffers.manage" },
  "product.soldOut": { category: "shop", audience: "user", shopPermission: "ownProducts.view" },
  "report.ready": { category: "shop", audience: "user", shopPermission: "ownReports.view" },
  "sale.adminPaused": { category: "shop", audience: "user", shopPermission: "ownOffers.manage" },
  "sale.adminDeleted": { category: "shop", audience: "user", shopPermission: "ownOffers.manage" },
  "discountCode.adminPaused": { category: "shop", audience: "user", shopPermission: "ownOffers.manage" },
  "discountCode.adminDeleted": { category: "shop", audience: "user", shopPermission: "ownOffers.manage" },
  "team.memberJoined": { category: "shop", audience: "user", shopPermission: "ownTeam.manage" },
  "team.accessChanged": { category: "shop", audience: "user" },
};

export const NOTIFICATION_TYPE_LIST = Object.keys(NOTIFICATION_TYPES) as NotificationType[];

/** The page a notification opens. */
export function notificationHref(data: NotificationData): string {
  switch (data.type) {
    case "changeRequest.submitted":
    case "changeRequest.flagged":
      // The list opens the request in its drawer (src/features/admin/shell/hrefs.ts).
      return `/admin/change-requests?${new URLSearchParams({ open: data.requestId })}`;
    case "changeRequest.approved":
    case "changeRequest.rejected":
      return "/dashboard/settings";
    case "admin.paymentFailed":
      return `/admin/payments?${new URLSearchParams({ status: "failed", search: data.shopName, open: data.paymentId })}`;
    case "admin.endingSoon":
      return `/admin/subscriptions?${new URLSearchParams({ from: data.day, to: addDays(data.day, EXPIRY_WARNING_DAYS) })}`;
    case "payment.failed":
    case "plan.activated":
    case "plan.expired":
    case "plan.endingSoon":
    case "plan.inGrace":
    case "plan.trialProOnly":
      return "/dashboard/billing";
    case "look.reset":
      return "/dashboard/look";
    case "sale.started":
    case "sale.endingSoon":
    case "sale.adminPaused":
      return `/dashboard/offers/${data.saleId}`;
    case "sale.ended":
    case "sale.adminDeleted":
      return "/dashboard/offers";
    case "discountCode.adminPaused":
      return `/dashboard/discount-codes/${data.codeId}`;
    case "discountCode.adminDeleted":
      return "/dashboard/discount-codes";
    case "product.soldOut":
      return `/dashboard/products/${data.productId}`;
    case "report.ready":
      return `/dashboard/reports?month=${data.month}`;
    case "team.memberJoined":
      return "/dashboard/team";
    case "team.accessChanged":
      return "/dashboard";
  }
}
