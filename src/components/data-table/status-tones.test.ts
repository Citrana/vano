import { describe, expect, test } from "vitest"
import { CHANGE_STATUSES } from "../../../convex/lib/changeRequests"
import { SUBSCRIPTION_STATUSES } from "../../../convex/lib/plans"
import { PAYMENT_STATUSES } from "../../../convex/payments/types"
import { STATUS_TONES, statusTone } from "./status-tones"

describe("status tones", () => {
  test("every status of every list has a tone", () => {
    for (const s of CHANGE_STATUSES) expect(STATUS_TONES.change[s]).toBeDefined()
    for (const s of PAYMENT_STATUSES) expect(STATUS_TONES.payment[s]).toBeDefined()
    for (const s of SUBSCRIPTION_STATUSES) expect(STATUS_TONES.subscription[s]).toBeDefined()
  })

  test("the same meaning has the same color across pages", () => {
    expect(statusTone("change", "pending")).toBe(statusTone("payment", "pending"))
    expect(statusTone("change", "rejected")).toBe(statusTone("payment", "failed"))
    expect(statusTone("user", "suspended")).toBe(statusTone("shop", "suspended"))
    expect(statusTone("change", "approved")).toBe(statusTone("subscription", "active"))
  })
})
