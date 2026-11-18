import { mockProvider } from "./mock";
import type { PaymentProvider } from "./provider";
import type { ProviderId } from "./types";

/**
 * Which payment provider is live, from deployment env vars (set with
 * `npx convex env set`, never from the admin UI):
 *
 *   PAYMENTS_PROVIDER       "mock" (later "mpesa", …). Unset = payments off.
 *   PAYMENTS_MOCK_ENABLED   must be "true" for the mock to run. Never set it
 *                           on the production deployment.
 *
 * With payments off, checkout throws PAYMENTS_UNAVAILABLE and the billing
 * page shows "Talk to us".
 */

const PROVIDERS: Record<ProviderId, PaymentProvider> = {
  mock: mockProvider,
};

/** True only when the mock is explicitly enabled on this deployment. */
export function mockEnabled(): boolean {
  return process.env.PAYMENTS_PROVIDER === "mock" && process.env.PAYMENTS_MOCK_ENABLED === "true";
}

export function activeProvider(): PaymentProvider | null {
  const id = process.env.PAYMENTS_PROVIDER;
  if (id === "mock") return mockEnabled() ? PROVIDERS.mock : null;
  return null;
}

/** The provider by id, only if it's the live one (webhooks, status polls). */
export function providerById(id: string): PaymentProvider | null {
  const provider = activeProvider();
  return provider !== null && provider.id === id ? provider : null;
}
