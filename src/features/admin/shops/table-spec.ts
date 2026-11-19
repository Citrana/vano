import { CATEGORY_KEYS } from "../../../../convex/lib/catalog"
import { CURRENCIES } from "../../../../convex/lib/money"
import type { TableSpec } from "../data-table/url-state"

/** /admin/shops URL keys. Newest first. */
export const SHOPS_SPEC = {
  filters: [
    { kind: "select", key: "status", options: ["active", "suspended"] },
    { kind: "select", key: "category", options: CATEGORY_KEYS },
    { kind: "select", key: "currency", options: CURRENCIES },
  ],
  order: "desc",
} as const satisfies TableSpec
