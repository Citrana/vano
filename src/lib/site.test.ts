import { describe, expect, test } from "vitest"
import { displayShopUrl } from "./site"

describe("displayShopUrl", () => {
  test("short form on a real domain", () => {
    expect(displayShopUrl("chez-amani", "https://vano.app")).toBe("vano.app/chez-amani")
    expect(displayShopUrl("chez-amani", "https://www.vano.app/")).toBe("vano.app/chez-amani")
  })

  test("full local address in development", () => {
    expect(displayShopUrl("chez-amani", "http://localhost:3000")).toBe("http://localhost:3000/chez-amani")
    expect(displayShopUrl("chez-amani", "http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000/chez-amani")
  })
})
