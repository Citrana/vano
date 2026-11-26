import { ConvexError } from "convex/values"
import { describe, expect, test } from "vitest"
import { classifyAuthError, isCodeSendProblem } from "./auth-error"

describe("classifyAuthError", () => {
  test("our ConvexError codes win", () => {
    const error = new ConvexError({ code: "EMAIL_SEND_FAILED" })
    expect(classifyAuthError(error, "signUp")).toEqual({ kind: "code", code: "EMAIL_SEND_FAILED" })
  })

  test("Convex Auth messages", () => {
    expect(classifyAuthError(new Error("Account amani@x.com already exists"), "signUp")).toEqual({ kind: "accountExists" })
    expect(classifyAuthError(new Error("InvalidSecret"), "signIn")).toEqual({ kind: "invalidCredentials" })
    expect(classifyAuthError(new Error("Could not verify code"), "email-verification")).toEqual({ kind: "invalidCode" })
    expect(classifyAuthError(new Error("Invalid code"), "reset-verification")).toEqual({ kind: "invalidCode" })
    // Code messages only count on the code flows.
    expect(classifyAuthError(new Error("Invalid code"), "signIn")).toEqual({ kind: "unknown" })
    expect(classifyAuthError(new Error("boom"), "reset")).toEqual({ kind: "unknown" })
  })

  test("a failed or limited code send moves the screen to the code step", () => {
    expect(isCodeSendProblem({ kind: "code", code: "EMAIL_SEND_FAILED" })).toBe(true)
    expect(isCodeSendProblem({ kind: "code", code: "CODE_RATE_LIMITED" })).toBe(true)
    expect(isCodeSendProblem({ kind: "code", code: "EMAIL_INVALID" })).toBe(false)
    expect(isCodeSendProblem({ kind: "invalidCredentials" })).toBe(false)
  })
})
