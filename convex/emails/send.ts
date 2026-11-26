import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, type ActionCtx, type MutationCtx } from "../_generated/server";
import { normalizeEmail } from "../lib/credentials";
import { fail } from "../lib/errors";
import { maskEmail } from "./address";
import { EMAIL_MAX_ATTEMPTS, retryDelay } from "./config";
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
    const provider = activeEmailProvider();
    let result;
    try {
      result = await provider.send(email);
    } catch (error) {
      // Providers shouldn't throw; treat it as temporary if one does.
      result = { ok: false as const, retryable: true, error: String(error) };
    }
    if (result.ok) return null;

    const who = maskEmail(email.to);
    const next = attempt + 1;
    if (result.retryable && next < EMAIL_MAX_ATTEMPTS) {
      const delay = retryDelay(attempt);
      console.warn(`[email] ${provider.id} attempt ${next} to ${who} failed, retrying in ${delay / 1000}s: ${result.error}`);
      await ctx.scheduler.runAfter(delay, internal.emails.send.deliver, { ...args, attempt: next });
      return null;
    }
    console.error(`[email] ${provider.id} gave up on ${who} after ${next} attempt(s): ${result.error}`);
    return null;
  },
});
