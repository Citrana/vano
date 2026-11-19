import { describe, expect, test } from "vitest"
import { billingFiltersFromParams } from "./billing/filter-params"
import { DEFAULT_FILTERS, changeRequestFiltersFromParams } from "./change-requests/filter-params"

const p = (query: string) => new URLSearchParams(query)

describe("billingFiltersFromParams", () => {
  test("reads known values and ignores the rest", () => {
    expect(billingFiltersFromParams(p("status=failed&from=2026-11-12&search=%20Chez%20Amani%20"), ["failed", "succeeded"])).toEqual({
      search: "Chez Amani",
      plan: "",
      status: "failed",
      from: "2026-11-12",
      to: "",
    })
    expect(billingFiltersFromParams(p("status=nope&plan=gold&from=12/11/2026"), ["failed"])).toEqual({
      search: "",
      plan: "",
      status: "",
      from: "",
      to: "",
    })
  })
})

describe("changeRequestFiltersFromParams", () => {
  test("no filter in the URL keeps the defaults", () => {
    expect(changeRequestFiltersFromParams(p(""))).toEqual(DEFAULT_FILTERS)
  })

  test("the flagged link: pending + flagged only", () => {
    expect(changeRequestFiltersFromParams(p("status=pending&flagged=1"))).toEqual({ ...DEFAULT_FILTERS, flagged: true })
  })

  test("any filter replaces the defaults; bad values are dropped", () => {
    expect(changeRequestFiltersFromParams(p("field=slug&status=maybe"))).toEqual({ ...DEFAULT_FILTERS, status: "", field: "slug" })
  })
})
