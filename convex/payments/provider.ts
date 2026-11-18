import type { Id } from "../_generated/dataModel";
import type { Currency } from "../lib/money";
import type { NextAction, ProviderEvent, ProviderId } from "./types";

/**
 * The one interface every payment provider implements (CLAUDE.md
 * "Billing"). The rest of the app only talks to this, so adding M-Pesa
 * (Daraja) or an aggregator means: a new file implementing it, its id in
 * types.ts, and a line in registry.ts. Nothing else changes.
 *
 * Results are never trusted from the browser: they reach the app as a
 * `ProviderEvent` (verified webhook, status poll, or the server-side mock
 * simulation) and are applied only by `payments/core.applyResult`, which
 * deduplicates them.
 */
export type StartInput = {
  paymentId: Id<"payments">;
  amountMinor: number;
  currency: Currency;
  /** E.g. "Vano Pro – 30 days". */
  description: string;
  /** E.164, for providers that push a prompt to a phone (M-Pesa STK). */
  phone?: string;
};

export type StartResult = {
  /** The provider's id for this payment; results quote it back. */
  providerRef: string;
  next: NextAction;
};

export interface PaymentProvider {
  readonly id: ProviderId;
  /** Asks the provider to start collecting. Runs in an action (may call HTTP). */
  start(input: StartInput): Promise<StartResult>;
  /**
   * Turns a webhook request into an event after verifying it really came
   * from the provider (signature, shared secret…). Null = reject it.
   */
  parseCallback(request: Request): Promise<ProviderEvent | null>;
  /** Asks the provider for the latest result. Null = nothing new. */
  checkStatus(providerRef: string): Promise<ProviderEvent | null>;
}
