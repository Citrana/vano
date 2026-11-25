import { describe, expect, test } from "vitest"
import { parseTableState } from "../../components/data-table/url-state"
import { saleHref, SALES_SPEC } from "./table-spec"

describe("Sales page links", () => {
  test("filters, sort and the open sale come from the address", () => {
    const params = new URLSearchParams(
      "from=2026-11-01&to=2026-11-30&source=instagram&status=reversed&product=k57abc123&order=asc&open=j97xyz",
    )
    const state = parseTableState(params, SALES_SPEC)
    expect(state.filters).toEqual({ from: "2026-11-01", to: "2026-11-30", source: "instagram", status: "reversed", product: "k57abc123" })
    expect(state.order).toBe("asc")
    expect(state.open).toBe("j97xyz")
  })

  test("unknown values fall back to the defaults", () => {
    const state = parseTableState(new URLSearchParams("source=fax&status=lost&from=yesterday"), SALES_SPEC)
    expect(state.filters).toMatchObject({ source: "", status: "", from: "" })
    expect(state.order).toBe("desc")
  })

  test("the product page's link opens the sale on its day", () => {
    const href = saleHref({ _id: "j97xyz", day: "2026-11-19" })
    const state = parseTableState(new URL(href, "https://vano.app").searchParams, SALES_SPEC)
    expect(state.filters).toMatchObject({ from: "2026-11-19", to: "2026-11-19" })
    expect(state.open).toBe("j97xyz")
  })
})
