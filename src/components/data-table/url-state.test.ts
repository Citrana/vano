import { describe, expect, test } from "vitest"
import {
  activeFilterCount,
  dayRange,
  defaultFilters,
  pageWindow,
  parseTableState,
  serializeTableState,
  type TableSpec,
} from "./url-state"

const p = (query: string) => new URLSearchParams(query)

const SPEC: TableSpec = {
  filters: [
    { kind: "select", key: "status", options: ["pending", "approved", "rejected"], default: "pending" },
    { kind: "select", key: "field", options: ["name", "slug"] },
    { kind: "select", key: "roleId" },
    { kind: "checkbox", key: "flagged" },
    { kind: "dateRange", fromKey: "from", toKey: "to" },
  ],
  order: "desc",
}

describe("parseTableState", () => {
  test("an empty URL gives the page's defaults", () => {
    expect(parseTableState(p(""), SPEC)).toEqual({
      search: "",
      filters: { status: "pending", field: "", roleId: "", flagged: "", from: "", to: "" },
      page: 1,
      size: 20,
      order: "desc",
      open: null,
    })
  })

  test("reads the attention and notification links", () => {
    const flagged = parseTableState(p("status=pending&flagged=1"), SPEC)
    expect(flagged.filters).toMatchObject({ status: "pending", flagged: "1" })
    const failed = parseTableState(p("status=approved&from=2026-11-12&search=%20Chez%20Amani%20"), SPEC)
    expect(failed).toMatchObject({ search: "Chez Amani", filters: { status: "approved", from: "2026-11-12" } })
  })

  test("`all` clears a select that has a default", () => {
    expect(parseTableState(p("status=all"), SPEC).filters.status).toBe("")
  })

  test("invalid values fall back to the defaults", () => {
    const state = parseTableState(
      p("status=maybe&field=email&roleId=<script>&flagged=yes&from=12/11/2026&page=-3&size=7&order=up&open=../x"),
      SPEC,
    )
    expect(state).toEqual(parseTableState(p(""), SPEC))
  })

  test("runtime ids (no option list) accept any safe id", () => {
    expect(parseTableState(p("roleId=k57abc123"), SPEC).filters.roleId).toBe("k57abc123")
  })

  test("page, size, order and open", () => {
    expect(parseTableState(p("page=3&size=50&order=asc&open=jd7abc"), SPEC)).toMatchObject({
      page: 3,
      size: 50,
      order: "asc",
      open: "jd7abc",
    })
    expect(parseTableState(p("page=99999"), SPEC).page).toBe(500)
  })
})

describe("serializeTableState", () => {
  test("defaults are left out", () => {
    expect(serializeTableState(parseTableState(p(""), SPEC), SPEC).toString()).toBe("")
  })

  test("round trip", () => {
    const query = "search=amani&status=all&field=slug&roleId=k57&flagged=1&from=2026-11-01&to=2026-11-15&order=asc&size=50&page=2&open=jd7"
    const state = parseTableState(p(query), SPEC)
    expect(serializeTableState(state, SPEC).toString()).toBe(query)
  })
})

describe("activeFilterCount", () => {
  test("counts what differs from the defaults; a date range counts once", () => {
    expect(activeFilterCount(defaultFilters(SPEC), SPEC)).toBe(0)
    expect(activeFilterCount({ ...defaultFilters(SPEC), status: "", from: "2026-11-01", to: "2026-11-02" }, SPEC)).toBe(2)
  })
})

describe("dayRange", () => {
  test("the end day is included", () => {
    expect(dayRange({ from: "2026-11-01", to: "2026-11-01" })).toEqual({
      from: Date.UTC(2026, 10, 1),
      to: Date.UTC(2026, 10, 2),
    })
    expect(dayRange({ from: "", to: "nope" })).toEqual({ from: undefined, to: undefined })
  })
})

describe("pageWindow", () => {
  test("first, last and neighbours, with gaps", () => {
    expect(pageWindow(1, 1, false)).toEqual([1])
    expect(pageWindow(5, 10, false)).toEqual([1, null, 4, 5, 6, null, 10])
    expect(pageWindow(2, 3, false)).toEqual([1, 2, 3])
  })

  test("an open end adds a trailing gap", () => {
    expect(pageWindow(2, 2, true)).toEqual([1, 2, null])
  })
})
