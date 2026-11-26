import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, type ActionCtx, type MutationCtx } from "../_generated/server";
import { normalizeEmail } from "../lib/credentials";
import { fail } from "../lib/errors";
import { maskEmail } from "./address";
import { EMAIL_MAX_ATTEMPTS, retryDelay } from "./config";
import type { SendResult } from "./provider";
import { activeEmailProvider } from "./registry";

/**
 * The one way to send an email (CLAUDE.md "Emails"). Call it from a
 * mutation or an action, with an email built by a template
 * (convex/emails/templates/):
 *
 *   await sendEmail(ctx, { to: user.email, ...testEmail("fr", { sentAt }) });
 *
 * It only schedules the delivery, so the caller's action is never slowed
 * down or failed by the provider. Delivery retries on temporary failures
 * (`EMAIL_MAX_ATTEMPTS`, `EMAIL_RETRY_DELAYS_MS`) with the same idempotency
 * key, so a retry never sends twice.
 */
export type EmailContent = { subject: string; html: string; text: string };

export async function sendEmail(
  ctx: MutationCtx | ActionCtx,
  email: EmailContent & { to: string },
): Promise<void> {
  const to = normalizeEmail(email.to);
  if (to === null) fail("EMAIL_INVALID");
  await ctx.scheduler.runAfter(0, internal.emails.send.deliver, {
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    idempotencyKey: crypto.randomUUID(),
    attempt: 0,
  });
}

/**
 * One call to the active provider. Never throws: a provider that throws
 * is treated as a temporary failure.
 */
async function attemptDelivery(email: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}): Promise<{ providerId: string; result: SendResult }> {
  const provider = activeEmailProvider();
  try {
    return { providerId: provider.id, result: await provider.send(email) };
  } catch (error) {
    return { providerId: provider.id, result: { ok: false, retryable: true, error: String(error) } };
  }
}

/**
 * Sends right now and returns whether it worked, for the one case where a
 * person waits on the screen for the email: sign-up and password reset
 * codes (CLAUDE.md "Auth codes"). Everything else uses `sendEmail`.
 *
 * Action only. One quick retry (same idempotency key) on a temporary
 * failure; the caller shows the error and lets the person try again.
 */
export async function sendEmailNow(
  _ctx: ActionCtx,
  email: EmailContent & { to: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const to = normalizeEmail(email.to);
  if (to === null) return { ok: false, error: "invalid address" };
  const outgoing = { to, subject: email.subject, html: email.html, text: email.text, idempotencyKey: crypto.randomUUID() };
  let attempt = await attemptDelivery(outgoing);
  if (!attempt.result.ok && attempt.result.retryable) attempt = await attemptDelivery(outgoing);
  if (attempt.result.ok) return { ok: true };
  console.error(`[email] ${attempt.providerId} could not send to ${maskEmail(to)} now: ${attempt.result.error}`);
  return { ok: false, error: attempt.result.error };
}

/** One delivery attempt; schedules the next one on a temporary failure. Never throws. */
export const deliver = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    text: v.string(),
    idempotencyKey: v.string(),
    attempt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { attempt, ...email } = args;
    const { providerId, result } = await attemptDelivery(email);
    if (result.ok) return null;

    const who = maskEmail(email.to);
    const next = attempt + 1;
    if (result.retryable && next < EMAIL_MAX_ATTEMPTS) {
      const delay = retryDelay(attempt);
      console.warn(`[email] ${providerId} attempt ${next} to ${who} failed, retrying in ${delay / 1000}s: ${result.error}`);
      await ctx.scheduler.runAfter(delay, internal.emails.send.deliver, { ...args, attempt: next });
      return null;
    }
    console.error(`[email] ${providerId} gave up on ${who} after ${next} attempt(s): ${result.error}`);
    return null;
  },
});
