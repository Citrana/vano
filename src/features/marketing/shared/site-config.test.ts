import { describe, expect, test } from "vitest"
import { parseEmail, parseWhatsapp } from "./site-config"

describe("site config", () => {
  test("WhatsApp number in international format", () => {
    expect(parseWhatsapp("+254 712 345 678")).toBe("+254712345678")
  })
  test("email", () => {
    expect(parseEmail(" hello@vano.app ")).toBe("hello@vano.app")
  })
  test("unset or invalid values are hidden", () => {
    expect(parseWhatsapp(undefined)).toBeNull()
    expect(parseWhatsapp("12")).toBeNull()
    expect(parseEmail("")).toBeNull()
    expect(parseEmail("not an email@")).toBeNull()
  })
})
