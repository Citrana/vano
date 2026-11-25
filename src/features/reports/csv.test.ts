import { describe, expect, test } from "vitest"
import { CSV_BOM, csvField, toCsv } from "./csv"

describe("report CSV", () => {
  test("quotes commas, quotes and line breaks", () => {
    expect(csvField("Robe")).toBe("Robe")
    expect(csvField("Robe, rouge")).toBe('"Robe, rouge"')
    expect(csvField('Robe "wax"')).toBe('"Robe ""wax"""')
    expect(csvField("a\nb")).toBe('"a\nb"')
    expect(csvField(null)).toBe("")
    expect(csvField(25.5)).toBe("25.5")
  })

  test("never starts a formula; negative numbers stay numbers", () => {
    expect(csvField("=SUM(A1)")).toBe("'=SUM(A1)")
    expect(csvField("@cmd")).toBe("'@cmd")
    expect(csvField("-12.5")).toBe("-12.5")
  })

  test("a BOM, a header row and CRLF lines", () => {
    expect(toCsv(["Date", "Total"], [["2026-11-03", "90"], ["2026-11-04", "Café, noir"]])).toBe(
      `${CSV_BOM}Date,Total\r\n2026-11-03,90\r\n2026-11-04,"Café, noir"\r\n`,
    )
  })
})
