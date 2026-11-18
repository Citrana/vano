import type { Id } from "../_generated/dataModel";
import type { PaymentProvider } from "./provider";
import type { PaymentOutcome, ProviderEvent } from "./types";

/**
 * Development-only provider: no money, no credentials. `start` accepts
 * every payment and sends the buyer to the in-app test checkout, where
 * the seller picks the result. That choice reaches the app through
 * `billing.mockSimulate`, which builds the event on the server with
 * `mockEvent` and hands it to `applyResult` like any provider result.
 *
 * It only runs when `PAYMENTS_PROVIDER=mock` and `PAYMENTS_MOCK_ENABLED=true`
 * are both set on the deployment (registry.ts) — never in production.
 */
export const mockProvider: PaymentProvider = {
  id: "mock",
  async start({ paymentId }) {
    return { providerRef: mockRef(paymentId), next: { kind: "mockCheckout" } };
  },
  // The mock has no webhooks: results come from the test checkout.
  async parseCallback() {
    return null;
  },
  // Nothing happens at the mock "provider" by itself.
  async checkStatus() {
    return null;
  },
};

export function mockRef(paymentId: Id<"payments">): string {
  return `mock_${paymentId}`;
}

/**
 * The event for a simulated result. The id is fixed per payment and
 * outcome, so a double click (or a replay) is recognised as the same
 * delivery and applied once.
 */
export function mockEvent(paymentId: Id<"payments">, outcome: PaymentOutcome): ProviderEvent {
  return {
    eventId: `${mockRef(paymentId)}_${outcome}`,
    providerRef: mockRef(paymentId),
    outcome,
    failureCode: outcome === "failed" ? "mock_declined" : undefined,
  };
}
