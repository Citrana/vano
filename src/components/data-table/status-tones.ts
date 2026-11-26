import type { ChangeStatus } from "../../../convex/lib/changeRequests"
import type { SubscriptionStatus } from "../../../convex/lib/plans"
import type { PaymentStatus } from "../../../convex/payments/types"
import type { SaleStatus } from "../../../convex/lib/sales/active"
import type { CodeStatus } from "../../../convex/lib/discountCodes/active"
import type { RecordStatus } from "../../../convex/lib/salesRecords/validators"
import type { MemberState } from "../../../convex/lib/team"

/**
 * One color per meaning across every admin list (CLAUDE.md "UI"):
 * warning = waiting on someone, success = done / live, danger = failed or
 * blocked, info = temporary (trial), muted = closed / inactive. Pure.
 */
export type StatusTone = "success" | "warning" | "danger" | "info" | "muted"

export type StatusKind =
  | "change"
  | "payment"
  | "subscription"
  | "user"
  | "shop"
  | "visibility"
  | "sale"
  | "discountCode"
  | "salesRecord"
  | "member"
  | "invite"

type ActiveStatus = "active" | "suspended"

export const STATUS_TONES = {
  change: { pending: "warning", approved: "success", rejected: "danger", cancelled: "muted" } satisfies Record<ChangeStatus, StatusTone>,
  payment: {
    created: "muted",
    pending: "warning",
    succeeded: "success",
    failed: "danger",
    cancelled: "muted",
    expired: "muted",
  } satisfies Record<PaymentStatus, StatusTone>,
  subscription: { trialing: "info", active: "success", expired: "danger", free: "muted" } satisfies Record<SubscriptionStatus, StatusTone>,
  user: { active: "success", suspended: "danger" } satisfies Record<ActiveStatus, StatusTone>,
  shop: { active: "success", suspended: "danger" } satisfies Record<ActiveStatus, StatusTone>,
  visibility: { visible: "success", hidden: "muted" } satisfies Record<"visible" | "hidden", StatusTone>,
  sale: { running: "success", scheduled: "info", paused: "warning", ended: "muted" } satisfies Record<SaleStatus, StatusTone>,
  discountCode: {
    running: "success",
    scheduled: "info",
    paused: "warning",
    usedUp: "muted",
    ended: "muted",
  } satisfies Record<CodeStatus, StatusTone>,
  salesRecord: { recorded: "success", reversed: "muted" } satisfies Record<RecordStatus, StatusTone>,
  /** Team members (CLAUDE.md "Team accounts"): paused = waiting on a plan change. */
  member: { active: "success", paused: "warning", suspended: "danger" } satisfies Record<MemberState, StatusTone>,
  invite: { pending: "warning", expired: "muted" } satisfies Record<"pending" | "expired", StatusTone>,
} as const

export type StatusOf<K extends StatusKind> = keyof (typeof STATUS_TONES)[K] & string

export function statusTone<K extends StatusKind>(kind: K, status: StatusOf<K>): StatusTone {
  return (STATUS_TONES[kind] as Record<string, StatusTone>)[status] ?? "muted"
}
