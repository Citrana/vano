import { PLAN_AREAS } from "../../../../convex/lib/planFeatures"
import type { TableSpec } from "../data-table/url-state"

/** /admin/plans URL keys: area, enforced or pricing-only, a name search, the open feature. */
export const PLAN_FEATURES_SPEC = {
  filters: [
    { kind: "select", key: "area", options: PLAN_AREAS },
    { kind: "select", key: "check", options: ["enforced", "pricingOnly"] },
  ],
} as const satisfies TableSpec
