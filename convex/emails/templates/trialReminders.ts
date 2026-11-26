import type { Language } from "../../lib/catalog";
import { renderEmail } from "../layout";
import type { EmailContent } from "../send";
import { emailTexts, fill } from "../texts";

/**
 * The three trial reminder emails (CLAUDE.md "Emails"), built by
 * `trialReminderEmail` (convex/emails/trialReminders.ts) from the shop's
 * real data and the plan config. Plan names, prices and limits are always
 * passed in, never written here.
 */

type Common = {
  /** The trial plan's name (from the plan config, in the shop's language). */
  planName: string;
  freeName: string;
  /** The billing page. */
  url: string;
};

export type TrialSoonValues = Common & {
  days: number;
  /** The trial end, already formatted in the shop's language and time zone. */
  date: string;
  built: { products: number; shopViews: number; whatsappClicks: number };
  /** What Free includes: its pricing card lines from the plan config (`includedCardLines`). */
  keep: string[];
};

export type TrialLastDaysValues = Common & {
  days: number;
  date: string;
  graceDays: number;
  pauses: { offers: boolean; looks: boolean; stats: boolean; productsHidden: number; productLimit: number };
  /** The trial plan's monthly price, formatted; null = no price set (button without it). */
  price: string | null;
};

export type TrialEndedValues = Common;

const plural = (count: number, one: string, other: string) => fill(count === 1 ? one : other, { count });

/** 7 days left: what they built (numbers above 0 only) and what they keep on Free. */
export function trialSoonEmail(language: Language, v: TrialSoonValues): EmailContent {
  const t = emailTexts(language).trialSoon;
  const names = { plan: v.planName, free: v.freeName, days: v.days, date: v.date };
  const b = t.built;
  const built = [
    v.built.products > 0 ? plural(v.built.products, b.productsOne, b.productsOther) : null,
    v.built.shopViews > 0 ? plural(v.built.shopViews, b.viewsOne, b.viewsOther) : null,
    v.built.whatsappClicks > 0 ? plural(v.built.whatsappClicks, b.clicksOne, b.clicksOther) : null,
  ].filter((line): line is string => line !== null);
  const { html, text } = renderEmail({
    language,
    preheader: fill(t.preheader, names),
    heading: fill(t.heading, names),
    paragraphs: [fill(t.intro, names), ...(built.length === 0 ? [t.builtNone] : [])],
    lists: [
      { title: t.builtTitle, items: built },
      { title: fill(t.keepTitle, names), items: v.keep },
    ],
    button: { label: t.button, url: v.url },
    notes: [t.choose, fill(t.note, names)],
  });
  return { subject: fill(t.subject, names), html, text };
}

/** 2 days left: what pauses on Free, and the button to keep the plan at its real price. */
export function trialLastDaysEmail(language: Language, v: TrialLastDaysValues): EmailContent {
  const t = emailTexts(language).trialLastDays;
  const names = { plan: v.planName, free: v.freeName, days: v.days, date: v.date, grace: v.graceDays };
  const p = t.pause;
  const pauses = [
    ...(v.pauses.offers ? [p.offers] : []),
    ...(v.pauses.looks ? [p.looks] : []),
    ...(v.pauses.stats ? [p.stats] : []),
    ...(v.pauses.productsHidden > 0
      ? [
          fill(v.pauses.productsHidden === 1 ? p.productsOne : p.productsOther, {
            count: v.pauses.productsHidden,
            limit: v.pauses.productLimit,
            free: v.freeName,
          }),
        ]
      : []),
  ];
  const one = v.days === 1;
  const { html, text } = renderEmail({
    language,
    preheader: fill(t.preheader, names),
    heading: fill(one ? t.headingOne : t.headingOther, names),
    paragraphs: [fill(t.intro, names)],
    lists: [{ title: fill(t.pauseTitle, names), items: pauses }],
    button: {
      label: v.price === null ? fill(t.button, names) : fill(t.buttonPrice, { ...names, price: v.price }),
      url: v.url,
    },
    notes: [t.safe, t.note],
  });
  return { subject: fill(one ? t.subjectOne : t.subjectOther, names), html, text };
}

/** Sent once the shop has moved to Free: data safe, nothing deleted, upgrade anytime. */
export function trialEndedEmail(language: Language, v: TrialEndedValues): EmailContent {
  const t = emailTexts(language).trialEnded;
  const names = { plan: v.planName, free: v.freeName };
  const { html, text } = renderEmail({
    language,
    preheader: t.preheader,
    heading: fill(t.heading, names),
    paragraphs: [fill(t.intro, names), fill(t.safe, names), t.upgrade],
    button: { label: t.button, url: v.url },
  });
  return { subject: fill(t.subject, names), html, text };
}
