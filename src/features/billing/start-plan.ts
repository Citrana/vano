/**
 * The plan a sign-up starts with, from the link's `?plan=` (the pricing
 * page's "Get Business"). Only "business" means anything (no trial, pay
 * Business right away); any other value is ignored. Pure (no "use client"),
 * so server pages can call it.
 */
export function startPlanParam(value: string | string[] | undefined): "business" | undefined {
  return value === "business" ? "business" : undefined
}

/** Where a new "Get Business" shop goes: its billing page, with the Business payment open. */
export const BUSINESS_CHECKOUT_HREF = "/dashboard/billing?upgrade=business"
