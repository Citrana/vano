import type { Language } from "../../lib/catalog";
import { renderEmail } from "../layout";
import type { EmailContent } from "../send";
import { emailTexts, fill } from "../texts";

export type WelcomeValues = {
  dashboardUrl: string;
  helpUrl: string;
  /** From the plan config; null when the shop started without a trial ("Get Business"). */
  trial: { months: number; planName: string } | null;
};

/** Sent once to a new shop owner (`sendWelcomeEmail`, convex/emails/welcome.ts). */
export function welcomeEmail(language: Language, { dashboardUrl, helpUrl, trial }: WelcomeValues): EmailContent {
  const t = emailTexts(language).welcome;
  const trialLine = trial
    ? fill(trial.months === 1 ? t.trialOne : t.trialOther, { months: trial.months, plan: trial.planName })
    : null;
  const { html, text } = renderEmail({
    language,
    preheader: t.preheader,
    heading: t.heading,
    paragraphs: [t.intro, ...(trialLine ? [trialLine] : []), t.stepsIntro],
    steps: [t.steps.shop, t.steps.products, t.steps.share],
    button: { label: t.button, url: dashboardUrl },
    notes: [t.lookTip, fill(t.help, { url: helpUrl })],
  });
  return { subject: t.subject, html, text };
}
