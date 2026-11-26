import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { normalizeEmail } from "../lib/credentials";
import { readPlanConfig } from "../lib/planConfig";
import { TRIAL_PLAN } from "../lib/plans";
import { trialMonthsOf } from "../lib/subscriptions";
import { sendEmail } from "./send";
import { welcomeEmail } from "./templates/welcome";

/**
 * The welcome email (CLAUDE.md "Emails"), sent by `shops.create` in the
 * same mutation, so only a new shop owner gets it (someone joining an
 * existing shop never creates one), in the shop's language.
 *
 * Once per account: `users.welcomeEmailSentAt` is set in the same
 * transaction, so a retried or failed sign-up never sends twice. It never
 * throws: a missing address or app URL skips the email, and delivery
 * itself runs later (`sendEmail` only schedules it), so the shop is always
 * created.
 */
export async function sendWelcomeEmail(
  ctx: MutationCtx,
  user: Doc<"users">,
  shop: Doc<"shops">,
  { trial }: { trial: boolean },
): Promise<void> {
  if (user.welcomeEmailSentAt !== undefined) return;
  const to = normalizeEmail(user.email);
  if (to === null) return;
  const siteUrl = process.env.SITE_URL?.replace(/\/+$/, "");
  if (!siteUrl) {
    console.warn("[email] SITE_URL is not set: welcome email skipped");
    return;
  }

  const config = trial ? await readPlanConfig(ctx) : null;
  await sendEmail(ctx, {
    to,
    ...welcomeEmail(shop.language, {
      dashboardUrl: `${siteUrl}/dashboard`,
      helpUrl: `${siteUrl}/help`,
      trial: config
        ? { months: trialMonthsOf(config), planName: config.plans[TRIAL_PLAN].name[shop.language] }
        : null,
    }),
  });
  await ctx.db.patch("users", user._id, { welcomeEmailSentAt: Date.now() });
}
