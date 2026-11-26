/**
 * The one interface an email provider implements (CLAUDE.md "Emails").
 * The rest of the app only calls `sendEmail` (convex/emails/send.ts), so
 * switching from Resend means: a file implementing this, its id in
 * `EmailProviderId`, and a line in registry.ts. Nothing else changes.
 */
export type EmailProviderId = "log" | "resend";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative (some clients and every spam filter read it). */
  text: string;
  /** Same key on every retry, so the provider never sends the email twice. */
  idempotencyKey: string;
};

export type SendResult =
  | { ok: true; providerMessageId?: string }
  /** `retryable`: worth trying again later (network, rate limit, provider down). */
  | { ok: false; retryable: boolean; error: string };

export interface EmailProvider {
  readonly id: EmailProviderId;
  /** Runs in an action (may call HTTP). Must never throw: failures are results. */
  send(email: OutgoingEmail): Promise<SendResult>;
}
