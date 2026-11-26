import { v } from "convex/values";
import { maskEmail } from "../emails/address";
import { emailMode } from "../emails/registry";
import { sendEmail } from "../emails/send";
import { testEmail } from "../emails/templates/test";
import { adminMutation, adminQuery } from "../lib/access";
import { logAdminAction } from "../lib/audit";
import { languageValidator } from "../lib/catalog";
import { normalizeEmail } from "../lib/credentials";
import { fail } from "../lib/errors";
import { rateLimiter } from "../lib/rateLimits";

/**
 * Admin Settings → Emails (CLAUDE.md "Emails"): shows how emails are sent
 * and sends a test email. The test always goes to the caller's own
 * account address, never to an address from the browser.
 */

const providerValidator = v.union(v.literal("log"), v.literal("resend"));

export const status = adminQuery({
  permission: "settings.view",
  args: {},
  returns: v.object({ provider: providerValidator, from: v.union(v.string(), v.null()) }),
  handler: async () => emailMode(),
});

export const sendTest = adminMutation({
  permission: "settings.manage",
  args: { language: languageValidator },
  returns: v.object({ to: v.string(), provider: providerValidator }),
  handler: async (ctx, { language }) => {
    const to = normalizeEmail(ctx.user.email);
    if (to === null) fail("EMAIL_MISSING");
    const { ok } = await rateLimiter.limit(ctx, "testEmail", { key: ctx.user._id });
    if (!ok) fail("TEST_EMAIL_RATE_LIMITED");

    const { provider } = emailMode();
    await sendEmail(ctx, { to, ...testEmail(language, { sentAt: Date.now() }) });
    await logAdminAction(ctx, {
      actor: ctx.user,
      action: "settings.testEmail",
      targetType: "settings",
      targetId: "email",
      targetLabel: "Test email",
      details: { provider, language },
    });
    return { to: maskEmail(to), provider };
  },
});
