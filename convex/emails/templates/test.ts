import type { Language } from "../../lib/catalog";
import { renderEmail } from "../layout";
import type { EmailContent } from "../send";
import { emailTexts, fill } from "../texts";

/**
 * The admin "Send test email" message. Every template follows this
 * shape: (language, values) → { subject, html, text }, texts from
 * `Emails.<name>.*`, drawn by `renderEmail`.
 */
export function testEmail(language: Language, { sentAt }: { sentAt: number }): EmailContent {
  const t = emailTexts(language).test;
  // Fixed format, UTC: the server doesn't know the reader's time zone.
  const date = new Date(sentAt).toISOString().slice(0, 16).replace("T", " ");
  const { html, text } = renderEmail({
    language,
    preheader: t.preheader,
    heading: t.heading,
    paragraphs: [t.body],
    notes: [fill(t.sentAt, { date })],
  });
  return { subject: t.subject, html, text };
}
