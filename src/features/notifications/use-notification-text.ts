"use client"

import { useFormatter, useTranslations } from "next-intl"
import type { ProtectedField } from "../../../convex/lib/changeRequests"
import { daysLeft } from "../../../convex/lib/plans"
import type { NotificationData } from "../../../convex/notifications/types"
import { displayShopUrl } from "@/lib/site"
import { usePlanName } from "@/features/billing/use-plan-catalog"

/**
 * Words a notification in the viewer's language (`Notifications.types.*`).
 * WhatsApp numbers arrive already masked from the server.
 */
export function useNotificationText(): (data: NotificationData, now: number) => string {
  const t = useTranslations("Notifications")
  const planName = usePlanName()
  const format = useFormatter()
  const field = (f: ProtectedField) => t(`field.${f}`)
  const value = (f: ProtectedField, v: string) => (f === "slug" ? displayShopUrl(v) : v)

  return (data, now) => {
    switch (data.type) {
      case "changeRequest.submitted":
        return t("types.changeRequest.submitted", { shop: data.shopName, field: field(data.field) })
      case "changeRequest.flagged":
        return t("types.changeRequest.flagged", {
          shop: data.shopName,
          field: field(data.field),
          value: value(data.field, data.value),
          brand: data.brand,
        })
      case "changeRequest.approved":
        return t("types.changeRequest.approved", { field: field(data.field), value: value(data.field, data.value) })
      case "changeRequest.rejected":
        return t("types.changeRequest.rejected", {
          field: field(data.field),
          value: value(data.field, data.value),
          reason: data.reason,
        })
      case "payment.failed":
        return t("types.payment.failed", { plan: planName(data.plan) })
      case "admin.paymentFailed":
        return t("types.admin.paymentFailed", { shop: data.shopName, plan: planName(data.plan), amount: data.amount })
      case "plan.activated":
        return t("types.plan.activated", {
          plan: planName(data.plan),
          date: format.dateTime(new Date(data.periodEnd), { dateStyle: "medium" }),
        })
      case "plan.expired":
        return t("types.plan.expired", { plan: planName(data.plan), trial: String(data.trial) })
      case "plan.endingSoon":
        return t("types.plan.endingSoon", {
          plan: planName(data.plan),
          trial: String(data.trial),
          days: daysLeft(data.periodEnd, now),
        })
      case "admin.endingSoon":
        return t("types.admin.endingSoon", { count: data.count, capped: String(data.capped) })
      case "look.reset":
        return t(
          data.scope === "banner" ? "types.look.resetBanner" : data.scope === "profile" ? "types.look.resetProfile" : "types.look.resetAll",
          { reason: data.reason },
        )
      case "sale.started":
        return t("types.sale.started", { name: data.name })
      case "sale.endingSoon":
        return t("types.sale.endingSoon", { name: data.name })
      case "sale.ended":
        return t("types.sale.ended", { name: data.name })
      case "sale.adminPaused":
        return t("types.sale.adminPaused", { name: data.name, reason: data.reason })
      case "sale.adminDeleted":
        return t("types.sale.adminDeleted", { name: data.name, reason: data.reason })
      case "discountCode.adminPaused":
        return t("types.discountCode.adminPaused", { code: data.code, reason: data.reason })
      case "discountCode.adminDeleted":
        return t("types.discountCode.adminDeleted", { code: data.code, reason: data.reason })
    }
  }
}
