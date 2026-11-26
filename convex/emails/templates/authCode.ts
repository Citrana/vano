import type { Language } from "../../lib/catalog";
import type { AuthCodeKind } from "../../lib/authCodes";
import { renderEmail } from "../layout";
import type { EmailContent } from "../send";
import { emailTexts, fill } from "../texts";

export type AuthCodeValues = { kind: AuthCodeKind; code: string; minutes: number };

/**
 * A sign-up verification or password reset code (convex/emails/authCode.ts),
 * in the account's language. The code is in the subject too, so it shows
 * in the phone's notification.
 */
export function authCodeEmail(language: Language, { kind, code, minutes }: AuthCodeValues): EmailContent {
  const t = kind === "verify" ? emailTexts(language).verifyCode : emailTexts(language).resetCode;
  const { html, text } = renderEmail({
    language,
    preheader: fill(t.preheader, { minutes }),
    heading: t.heading,
    paragraphs: [t.intro],
    code,
    notes: [fill(t.expires, { minutes }), t.ignore],
  });
  return { subject: fill(t.subject, { code }), html, text };
}
