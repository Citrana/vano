import type { Language } from "../../lib/catalog";
import { renderEmail } from "../layout";
import type { EmailContent } from "../send";
import { emailTexts } from "../texts";

/** Absolute links, or null when `SITE_URL` isn't set (the email then has no buttons). */
export type AccountExistsValues = { loginUrl: string | null; resetUrl: string | null };

/**
 * Sent instead of a sign-up code when the email already has an account
 * (`sendAccountExistsEmail`, convex/emails/authCode.ts), in the account's
 * language, so the sign-up screen never reveals that the account exists.
 */
export function accountExistsEmail(language: Language, { loginUrl, resetUrl }: AccountExistsValues): EmailContent {
  const t = emailTexts(language).accountExists;
  const { html, text } = renderEmail({
    language,
    preheader: t.preheader,
    heading: t.heading,
    paragraphs: [t.intro, t.whatNext],
    ...(loginUrl ? { button: { label: t.loginButton, url: loginUrl } } : {}),
    ...(resetUrl ? { secondaryButton: { label: t.resetButton, url: resetUrl } } : {}),
    notes: [t.ignore],
  });
  return { subject: t.subject, html, text };
}
