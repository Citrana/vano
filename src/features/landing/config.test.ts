import { describe, expect, test } from "vitest"
import { parseContact } from "./config"

describe("parseContact", () => {
  test("email", () => {
    expect(parseContact(" hello@vano.app ")).toEqual({ kind: "email", href: "mailto:hello@vano.app", label: "hello@vano.app" })
  })
  test("WhatsApp number in international format", () => {
    expect(parseContact("+243 812 345 678")).toEqual({ kind: "whatsapp", href: "https://wa.me/243812345678?text=" })
  })
  test("unset or invalid hides the link", () => {
    expect(parseContact(undefined)).toBeNull()
    expect(parseContact("  ")).toBeNull()
    expect(parseContact("not an email@")).toBeNull()
    expect(parseContact("12")).toBeNull()
  })
})
