import { describe, expect, test } from "vitest"
import { inviteFromNext, nextParam, withNext } from "./next-param"

const TOKEN = "ab".repeat(32)

describe("next param", () => {
  test("keeps internal paths only", () => {
    expect(nextParam(`/join/${TOKEN}`)).toBe(`/join/${TOKEN}`)
    expect(nextParam("/dashboard/team")).toBe("/dashboard/team")
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "join", "/a b", "javascript:alert(1)", undefined, ["/x"]]) {
      expect(nextParam(bad as string | undefined)).toBeUndefined()
    }
    expect(nextParam("/" + "a".repeat(300))).toBeUndefined()
  })

  test("finds an invite token", () => {
    expect(inviteFromNext(`/join/${TOKEN}`)).toBe(TOKEN)
    expect(inviteFromNext("/join/short")).toBeUndefined()
    expect(inviteFromNext(`/join/${TOKEN}/x`)).toBeUndefined()
    expect(inviteFromNext(undefined)).toBeUndefined()
  })

  test("withNext", () => {
    expect(withNext("/login", undefined)).toBe("/login")
    expect(withNext("/signup", "/join/x")).toBe("/signup?next=%2Fjoin%2Fx")
  })
})
