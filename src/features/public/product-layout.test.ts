import { describe, expect, test } from "vitest"
import { orderHref } from "../../lib/whatsapp"
import { productListClasses } from "./product-layout"

describe("productListClasses", () => {
  test("normal cards, left-aligned, never centred; phones at most 2 columns", () => {
    for (const layout of ["grid2", "grid3", "large"] as const) {
      for (const columns of ["responsive", "phone"] as const) {
        const { list } = productListClasses(layout, columns)
        expect(list).toMatch(/^grid /)
        expect(list).not.toMatch(/justify-center|mx-auto/)
      }
    }
    expect(productListClasses("large", "phone").list).toContain("grid-cols-1")
    expect(productListClasses("grid3", "phone").list).toContain("grid-cols-2")
    expect(productListClasses("large", "responsive").size).toBe("large")
  })
})

describe("orderHref", () => {
  const t = (key: string, values?: Record<string, string>) => `${key}${values ? ` ${Object.values(values).join(" / ")}` : ""}`
  const base = { product: "Robe", price: "KES 700", url: "https://vano.app/s/p1", demoNote: "DEMO" }

  test("name, sale price with the normal price, and the product link, to the shop's number", () => {
    const href = orderHref(t, { ...base, normalPrice: "KES 1,000", whatsappNumber: "+254712345678" })
    expect(href.startsWith("https://wa.me/254712345678?text=")).toBe(true)
    const text = decodeURIComponent(href.split("text=")[1])
    expect(text).toContain("orderProduct Robe")
    expect(text).toContain("orderSalePrice KES 700 / KES 1,000")
    expect(text).toContain("orderLink https://vano.app/s/p1")
  })

  test("demo: a share link with the demo note", () => {
    const href = orderHref(t, { ...base, demo: true, whatsappNumber: "+254712345678" })
    expect(href.startsWith("https://wa.me/?text=")).toBe(true)
    expect(decodeURIComponent(href.split("text=")[1]).startsWith("DEMO")).toBe(true)
  })
})
