import { v, type Infer } from "convex/values";

/**
 * Payment vocabulary shared by the schema, the provider implementations
 * and the UI (CLAUDE.md "Billing"). Adding a provider: add its id here,
 * implement `PaymentProvider` (provider.ts) and register it in registry.ts.
 */

export const PROVIDER_IDS = ["mock"] as const;
export const providerIdValidator = v.literal("mock");
export type ProviderId = Infer<typeof providerIdValidator>;

/**
 * created: row inserted, provider not called yet. pending: the provider
 * has it, waiting for the result. The others are final: once a payment
 * reaches one, nothing changes it again.
 */
export const PAYMENT_STATUSES = ["created", "pending", "succeeded", "failed", "cancelled", "expired"] as const;
export const paymentStatusValidator = v.union(
  v.literal("created"),
  v.literal("pending"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("expired"),
);
export type PaymentStatus = Infer<typeof paymentStatusValidator>;

export function isOpenPayment(status: PaymentStatus): boolean {
  return status === "created" || status === "pending";
}

/** What a provider reports about a payment. */
export const paymentOutcomeValidator = v.union(
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("pending"),
  v.literal("cancelled"),
  v.literal("expired"),
);
export type PaymentOutcome = Infer<typeof paymentOutcomeValidator>;

/** A result from a provider, after its signature / origin was verified. */
export const providerEventValidator = v.object({
  /** Unique per result at the provider; repeated deliveries share it. */
  eventId: v.string(),
  providerRef: v.string(),
  outcome: paymentOutcomeValidator,
  failureCode: v.optional(v.string()),
});
export type ProviderEvent = Infer<typeof providerEventValidator>;

/** What the buyer does next, from the provider's `start`. */
export const nextActionValidator = v.union(
  /** The development-only test checkout (mock provider). */
  v.object({ kind: v.literal("mockCheckout") }),
  /** E.g. an M-Pesa STK push: confirm on the phone, then wait. */
  v.object({ kind: v.literal("awaitPhoneConfirmation") }),
  /** A hosted payment page. */
  v.object({ kind: v.literal("redirect"), url: v.string() }),
);
export type NextAction = Infer<typeof nextActionValidator>;
