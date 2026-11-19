import { v, type Infer } from "convex/values";
import { LIMITS } from "./catalog";
import { DAY_MS } from "./plans";
import { normalizeWhatsapp } from "./phone";
import { slugProblem } from "./slug";

/**
 * Protected shop fields (CLAUDE.md "Protected shop changes"): after the
 * shop is created, its name, link and WhatsApp number only change through
 * a request an admin approves. Every limit of the flow lives here.
 */
export const PROTECTED_FIELDS = ["name", "slug", "whatsapp"] as const;
export type ProtectedField = (typeof PROTECTED_FIELDS)[number];
export const protectedFieldValidator = v.union(
  v.literal("name"),
  v.literal("slug"),
  v.literal("whatsapp"),
);

export const CHANGE_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export const changeStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("cancelled"),
);
export type ChangeStatus = Infer<typeof changeStatusValidator>;

/** Reasons a request is shown to the admin with a warning. */
export const CHANGE_FLAGS = ["brand", "cooldown"] as const;
export const changeFlagValidator = v.union(v.literal("brand"), v.literal("cooldown"));
export type ChangeFlag = Infer<typeof changeFlagValidator>;

/** Days between two approved changes of the same field (admins can override). */
export const CHANGE_COOLDOWN_DAYS = 30;
/** How long an old shop link keeps redirecting (and stays reserved). */
export const SLUG_REDIRECT_DAYS = 90;
/** The seller's reason for asking. */
export const CHANGE_REASON_MIN = 20;
export const CHANGE_REASON_MAX = 500;
/** The admin's reason for a rejection (shown to the seller). */
export const DECISION_REASON_MIN = 5;
export const DECISION_REASON_MAX = 500;
/** WhatsApp verification codes. */
export const CODE_LENGTH = 6;
export const CODE_TTL_MINUTES = 10;
export const CODE_MAX_ATTEMPTS = 5;
/** A verified code must be used for a request within this time. */
export const VERIFIED_TTL_MINUTES = 30;

export function reasonProblem(reason: string, min = CHANGE_REASON_MIN, max = CHANGE_REASON_MAX): "length" | null {
  const length = reason.trim().length;
  return length < min || length > max ? "length" : null;
}

/** Trimmed shop name, or null when its length is out of bounds. */
export function cleanShopName(name: string): string | null {
  const trimmed = name.trim().replace(/\s+/g, " ");
  return trimmed.length < LIMITS.shopNameMin || trimmed.length > LIMITS.shopNameMax ? null : trimmed;
}

export type NewValueProblem = "invalid" | "reserved" | "same";

/**
 * Normalizes a requested value: name trimmed, slug as typed, WhatsApp to
 * E.164 (the client sends the full number). `current` is the live value.
 */
export function cleanNewValue(
  field: ProtectedField,
  raw: string,
  current: string,
): { value: string } | { problem: NewValueProblem } {
  let value: string | null;
  if (field === "name") {
    value = cleanShopName(raw);
  } else if (field === "slug") {
    const slug = raw.trim();
    const problem = slugProblem(slug);
    if (problem === "reserved") return { problem: "reserved" };
    value = problem === null ? slug : null;
  } else {
    value = normalizeWhatsapp(raw);
  }
  if (value === null) return { problem: "invalid" };
  if (value === current) return { problem: "same" };
  return { value };
}

/** True while the last approved change of a field is under the cooldown. */
export function inCooldown(lastApprovedAt: number | null, now: number): boolean {
  return lastApprovedAt !== null && now - lastApprovedAt < CHANGE_COOLDOWN_DAYS * DAY_MS;
}

/** "+243812345678" → "+243 ••• ••• 678" for the activity history. */
export function maskPhone(phone: string): string {
  if (phone.length < 7) return "•••";
  return `${phone.slice(0, 4)} ••• ••• ${phone.slice(-3)}`;
}
