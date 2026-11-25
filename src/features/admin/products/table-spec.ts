import { CATEGORY_KEYS } from "../../../../convex/lib/catalog"
import type { TableSpec } from "../../../components/data-table/url-state"

/** /admin/products URL keys. Newest first. */
export const PRODUCTS_SPEC = {
  filters: [
    { kind: "select", key: "visibility", options: ["visible", "hidden"] },
    { kind: "select", key: "category", options: CATEGORY_KEYS },
  ],
  order: "desc",
} as const satisfies TableSpec
