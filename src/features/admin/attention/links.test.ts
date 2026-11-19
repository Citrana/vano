import { describe, expect, test } from "vitest"
import { CHANGE_REQUESTS_SPEC } from "../change-requests/table-spec"
import { parseTableState } from "../data-table/url-state"
import { attentionHref } from "./links"

const NOW = Date.parse("2026-11-19T12:00:00Z")
const query = (href: string) => new URLSearchParams(href.split("?")[1])

describe("attentionHref", () => {
  test("each card's link presets the list's filters", () => {
    expect(parseTableState(query(attentionHref("flaggedChangeRequests", NOW)), CHANGE_REQUESTS_SPEC).filters).toMatchObject({
      status: "pending",
      flagged: "1",
    })
    expect(parseTableState(query(attentionHref("pendingChangeRequests", NOW)), CHANGE_REQUESTS_SPEC).filters).toMatchObject({
      status: "pending",
      flagged: "",
    })
    expect(attentionHref("failedPayments", NOW)).toBe("/admin/payments?status=failed&from=2026-11-12")
    expect(attentionHref("endingSoon", NOW)).toBe("/admin/subscriptions?from=2026-11-19&to=2026-11-26")
  })
})
