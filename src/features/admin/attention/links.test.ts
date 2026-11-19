import { describe, expect, test } from "vitest"
import { billingFiltersFromParams } from "../billing/filter-params"
import { changeRequestFiltersFromParams } from "../change-requests/filter-params"
import { attentionHref } from "./links"

const NOW = Date.parse("2026-11-19T12:00:00Z")
const query = (href: string) => new URLSearchParams(href.split("?")[1])

describe("attentionHref", () => {
  test("each card's link presets the list's filters", () => {
    expect(changeRequestFiltersFromParams(query(attentionHref("flaggedChangeRequests", NOW)))).toMatchObject({
      status: "pending",
      flagged: true,
    })
    expect(billingFiltersFromParams(query(attentionHref("failedPayments", NOW)), ["failed"])).toMatchObject({
      status: "failed",
      from: "2026-11-12",
    })
    expect(attentionHref("endingSoon", NOW)).toBe("/admin/subscriptions?from=2026-11-19&to=2026-11-26")
  })
})
