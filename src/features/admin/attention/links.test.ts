import { describe, expect, test } from "vitest"
import { PAYMENTS_SPEC, SUBSCRIPTIONS_SPEC } from "../billing/table-spec"
import { CHANGE_REQUESTS_SPEC } from "../change-requests/table-spec"
import { parseTableState } from "../../../components/data-table/url-state"
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
    expect(parseTableState(query(attentionHref("failedPayments", NOW)), PAYMENTS_SPEC).filters).toEqual({
      status: "failed",
      plan: "",
      from: "2026-11-12",
      to: "",
    })
    expect(parseTableState(query(attentionHref("endingSoon", NOW)), SUBSCRIPTIONS_SPEC).filters).toEqual({
      status: "",
      plan: "",
      from: "2026-11-19",
      to: "2026-11-26",
    })
  })
})
