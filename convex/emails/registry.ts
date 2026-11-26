import { logProvider } from "./log";
import type { EmailProvider, EmailProviderId } from "./provider";
import { resendProvider } from "./resend";

/**
 * Which provider sends emails, from deployment env vars
 * (`npx convex env set`, never from the UI):
 *
 *   RESEND_API_KEY   Resend API key ("re_…"). Unset = log mode: emails
 *                    are written to the Convex logs, never sent.
 *   EMAIL_FROM       Sender, e.g. "Vano <hello@vano.app>" (a domain
 *                    verified in Resend). Required with the key.
 *   EMAIL_REPLY_TO   Optional reply-to address.
 *
 * A missing or half-set configuration never crashes: it falls back to
 * log mode.
 */
const PROVIDERS: Record<EmailProviderId, EmailProvider> = {
  log: logProvider,
  resend: resendProvider,
};

export function activeEmailProviderId(): EmailProviderId {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  return key && from ? "resend" : "log";
}

export function activeEmailProvider(): EmailProvider {
  const id = activeEmailProviderId();
  if (id === "log" && process.env.RESEND_API_KEY?.trim()) {
    console.warn("[email] RESEND_API_KEY is set but EMAIL_FROM is missing: emails are only logged");
  }
  return PROVIDERS[id];
}

/** What the admin Settings page shows. */
export function emailMode(): { provider: EmailProviderId; from: string | null } {
  const provider = activeEmailProviderId();
  return { provider, from: provider === "resend" ? (process.env.EMAIL_FROM?.trim() ?? null) : null };
}
