import type { EmailProvider, SendResult } from "./provider";

/**
 * Resend (https://resend.com/docs/api-reference/emails/send-email), called
 * with `fetch` so no SDK is needed. Settings come from deployment env vars
 * (see registry.ts). Never throws: every outcome is a `SendResult`.
 */
const ENDPOINT = "https://api.resend.com/emails";

export const resendProvider: EmailProvider = {
  id: "resend",
  async send({ to, subject, html, text, idempotencyKey }): Promise<SendResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) return { ok: false, retryable: false, error: "resend not configured" };
    const replyTo = process.env.EMAIL_REPLY_TO?.trim();

    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ from, to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
      });
    } catch (error) {
      return { ok: false, retryable: true, error: `network: ${String(error)}` };
    }

    if (response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const id = typeof body === "object" && body !== null && "id" in body && typeof body.id === "string" ? body.id : undefined;
      return { ok: true, providerMessageId: id };
    }
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    // Rate limited or provider trouble: try later. Other 4xx (bad from
    // address, unverified domain, invalid key…) won't fix themselves.
    const retryable = response.status === 429 || response.status >= 500;
    return { ok: false, retryable, error: `resend ${response.status}: ${detail}` };
  },
};
