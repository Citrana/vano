"use client"

import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useCallback, useSyncExternalStore } from "react"
import { api } from "../../../convex/_generated/api"
import { canShopDo } from "../../../convex/lib/entitlements"
import { toPlanLimits } from "../../../convex/lib/planFeatures"
import { visibleNav, type NavCounts } from "@/components/shell/nav/nav-model"
import { useShopLimits } from "@/features/billing/use-billing"
import { useUpgradePlanNames } from "@/features/billing/use-plan-catalog"
import { SELLER_NAV, type SellerNavBadge, type SellerNavItem } from "./seller-nav"

/**
 * Live counts for seller menu badges. Counts come from real tables, never
 * from notifications (CLAUDE.md "Notifications"). None yet: a new badge
 * adds a `SellerNavBadge` key and its field here.
 */
export function useSellerNavCounts(): NavCounts<SellerNavBadge> {
  return {}
}

/**
 * Everything the seller menus draw: the items the viewer may open, which
 * ones need a plan feature the shop lacks, badge counts and labels.
 */
export function useSellerNav() {
  const t = useTranslations("Seller")
  const viewer = useQuery(api.users.viewer, {})
  const billing = useShopLimits()
  const upgradePlan = useUpgradePlanNames()
  const counts = useSellerNavCounts()
  const items = visibleNav(viewer?.permissions ?? [], SELLER_NAV)
  // Locks show only once the plan is known, so they never flash.
  const limits = billing ? toPlanLimits(billing.limits) : null

  const locked = useCallback(
    (item: SellerNavItem) =>
      item.feature !== undefined &&
      limits !== null &&
      canShopDo(limits, { kind: "feature", feature: item.feature }) !== null,
    [limits],
  )

  return {
    viewer,
    items,
    counts,
    locked,
    label: (item: SellerNavItem) => t(`nav.${item.key}`),
    lockLabel: (item: SellerNavItem) => (item.feature ? t("locked", { plan: upgradePlan(item.feature) }) : ""),
    groupLabel: (group: NonNullable<SellerNavItem["group"]>) => t(`groups.${group}`),
  }
}

// Desktop sidebar collapsed or not: a per-browser convenience (CLAUDE.md
// "Browser storage"); storage may be blocked, so it falls back to open.
const COLLAPSED_KEY = "vano.sellerNav.collapsed"
const listeners = new Set<() => void>()
/** This tab's choice (also works when storage is blocked). */
let chosen: boolean | undefined

function readCollapsed(): boolean {
  if (chosen !== undefined) return chosen
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1"
  } catch {
    return false
  }
}

function subscribe(onChange: () => void) {
  // Another tab changed it: follow the stored value.
  const onStorage = () => {
    chosen = undefined
    onChange()
  }
  listeners.add(onChange)
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onStorage)
  }
}

export function useSidebarCollapsed(): [boolean, (next: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false)
  const set = useCallback((next: boolean) => {
    chosen = next
    try {
      window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0")
    } catch {
      // Storage blocked: the choice lasts until the page reloads.
    }
    listeners.forEach((listener) => listener())
  }, [])
  return [collapsed, set]
}
