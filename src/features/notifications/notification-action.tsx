"use client"

import { useMutation, useQuery } from "convex/react"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import type { NotificationType } from "../../../convex/notifications/types"
import { Button } from "@/components/ui/button"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { useErrorMessage } from "@/lib/use-error-message"
import type { NotificationRow } from "./notification-item"

/**
 * Notification types with an action of their own besides the row's link
 * (CLAUDE.md "Notifications"). It's drawn beside the row, never inside it
 * (the row is already a button / menu item).
 */
const ACTION_TYPES: ReadonlySet<NotificationType> = new Set(["product.soldOut"])

export function hasNotificationAction(row: NotificationRow): boolean {
  return ACTION_TYPES.has(row.data.type)
}

/**
 * "Hide product" / "Show in shop" for a sold-out product's notification;
 * only for someone whose role may edit products in the current shop.
 */
function useHideProduct(productId: Id<"products">) {
  const t = useTranslations("Notifications.actions")
  const errorMessage = useErrorMessage()
  const viewer = useQuery(api.users.viewer, {})
  const canEdit = viewer?.permissions.includes("ownProducts.manage") ?? false
  const state = useQuery(api.products.visibility, canEdit ? { productId } : "skip")
  const setHidden = useMutation(api.products.setHiddenBySeller)
  const [pending, setPending] = useState(false)
  if (!state || state.hiddenByAdmin) return null
  const hide = !state.hiddenBySeller
  return {
    label: hide ? t("hideProduct") : t("showProduct"),
    icon: hide ? <EyeOffIcon /> : <EyeIcon />,
    pending,
    run: async () => {
      setPending(true)
      try {
        await setHidden({ productId, hidden: hide })
        toast.success(hide ? t("hidden") : t("shown"))
      } catch (error) {
        toast.error(errorMessage(error))
      } finally {
        setPending(false)
      }
    },
  }
}

/** The action as a small button (inbox page). */
export function NotificationActionButton({ row }: { row: NotificationRow }) {
  if (row.data.type !== "product.soldOut") return null
  return <HideButton productId={row.data.productId} />
}

function HideButton({ productId }: { productId: Id<"products"> }) {
  const action = useHideProduct(productId)
  if (!action) return null
  return (
    <Button variant="outline" size="sm" className="min-h-11 md:min-h-8" disabled={action.pending} onClick={action.run}>
      {action.icon}
      {action.label}
    </Button>
  )
}

/** The action as its own menu item (bell), which keeps the menu open. */
export function NotificationActionMenuItem({ row }: { row: NotificationRow }) {
  if (row.data.type !== "product.soldOut") return null
  return <HideMenuItem productId={row.data.productId} />
}

function HideMenuItem({ productId }: { productId: Id<"products"> }) {
  const action = useHideProduct(productId)
  if (!action) return null
  return (
    <DropdownMenuItem
      className="ml-12 min-h-11 w-fit rounded-md px-2 text-sm font-medium md:min-h-9"
      disabled={action.pending}
      closeOnClick={false}
      onClick={action.run}
    >
      {action.icon}
      {action.label}
    </DropdownMenuItem>
  )
}
