import { maskPhone } from "../../lib/changeRequests";
import type { Language } from "../../lib/catalog";
import type { DowngradeImpact } from "../../lib/downgradeImpact";
import { renderEmail } from "../layout";
import type { EmailContent } from "../send";
import { emailTexts, fill } from "../texts";

/**
 * Plan emails (CLAUDE.md "Emails", docs/payments.md section 15), built by
 * convex/emails/planEmails.ts from the payment or change record and the
 * plan config. Plan names, prices and dates are always passed in, already
 * formatted in the recipient's language (dates in Nairobi time).
 */

export type PlanReceiptValues = {
  kind: "upgrade" | "renewal";
  planName: string;
  /** Amount paid, formatted (`formatPlanPrice`). */
  amount: string;
  /** Upgrade credit for the lower plan's unused paid days, when there was one. */
  credit: { amount: string; planName: string } | null;
  paidOn: string;
  reference: string;
  newEnd: string;
  /** What the plan now unlocks (plan config card lines); upgrades only. */
  unlocks: string[];
  trial: "kept" | "ended" | null;
  /** The payer's phone (e.g. M-Pesa), when a provider stores one: always masked here. */
  paidFrom?: string | null;
  /** The billing page. */
  url: string;
};

/** Upgrade and renewal receipts: one layout, the heading and intro change. */
export function planReceiptEmail(language: Language, v: PlanReceiptValues): EmailContent {
  const t = emailTexts(language).planReceipt;
  const names = { plan: v.planName, amount: v.amount, end: v.newEnd };
  const upgrade = v.kind === "upgrade";
  const r = t.rows;
  const trialLine = v.trial === "kept" ? t.trialKept : v.trial === "ended" ? fill(t.trialEnded, names) : null;
  const { html, text } = renderEmail({
    language,
    preheader: fill(upgrade ? t.preheaderUpgrade : t.preheaderRenewal, names),
    heading: fill(upgrade ? t.headingUpgrade : t.headingRenewal, names),
    paragraphs: [fill(upgrade ? t.introUpgrade : t.introRenewal, names), ...(trialLine ? [trialLine] : [])],
    details: [
      { label: r.plan, value: v.planName },
      ...(v.credit ? [{ label: fill(r.credit, { plan: v.credit.planName }), value: `−${v.credit.amount}` }] : []),
      { label: r.amount, value: v.amount },
      { label: r.date, value: v.paidOn },
      { label: r.reference, value: v.reference },
      ...(v.paidFrom ? [{ label: r.paidFrom, value: maskPhone(v.paidFrom) }] : []),
      { label: r.end, value: v.newEnd },
    ],
    lists: upgrade ? [{ title: t.unlocksTitle, items: v.unlocks }] : [],
    button: { label: t.button, url: v.url },
    notes: [t.keep, t.noRenew, t.timeZone],
  });
  return { subject: fill(upgrade ? t.subjectUpgrade : t.subjectRenewal, names), html, text };
}

export type PlanDowngradeValues = {
  planName: string;
  targetName: string;
  freeName: string;
  /** When the current plan ends (the change takes effect), formatted. */
  date: string;
  /** When the shop moves to Free (end + grace days), formatted. */
  freeDate: string;
  /** Free, or a lower paid plan with its monthly price (formatted; null when unset) and period length. */
  target: { paid: false } | { paid: true; price: string | null; days: number };
  /** What would pause, from `shopDowngradeImpact` (the downgrade dialog's rule). */
  impact: DowngradeImpact;
  /** "Keep my plan": the billing page with the change to cancel. */
  keepUrl: string;
};

const plural = (count: number, one: string, other: string) => fill(count === 1 ? one : other, { count });

function pauseLines(language: Language, impact: DowngradeImpact): string[] {
  const p = emailTexts(language).planDowngrade.pause;
  const lines = [
    ...(impact.sales > 0 ? [plural(impact.sales, p.salesOne, p.salesOther)] : []),
    ...(impact.discountCodes > 0 ? [plural(impact.discountCodes, p.codesOne, p.codesOther)] : []),
    ...(impact.productsHidden > 0 ? [plural(impact.productsHidden, p.productsOne, p.productsOther)] : []),
    ...(impact.look ? [p.look] : []),
    ...(impact.sections ? [p.sections] : []),
    ...(impact.eventBanner ? [p.eventBanner] : []),
    ...(impact.promoBar ? [p.promoBar] : []),
  ];
  return lines.length > 0 ? lines : [p.nothing];
}

/** A lower plan or Free, chosen by the seller: not a payment, takes effect at the end date. */
export function planDowngradeEmail(language: Language, v: PlanDowngradeValues): EmailContent {
  const t = emailTexts(language).planDowngrade;
  const names = { plan: v.planName, target: v.targetName, free: v.freeName, date: v.date, freeDate: v.freeDate };
  const paidNote = v.target.paid
    ? v.target.price === null
      ? fill(t.paidNoteNoPrice, names)
      : fill(t.paidNote, { ...names, price: v.target.price, days: v.target.days })
    : null;
  const { html, text } = renderEmail({
    language,
    preheader: fill(t.preheader, names),
    heading: t.heading,
    paragraphs: [fill(t.intro, names), fill(t.effective, names), ...(paidNote ? [paidNote] : [])],
    details: [
      { label: t.rows.current, value: v.planName },
      { label: fill(t.rows.until, names), value: v.date },
      { label: fill(t.rows.free, names), value: v.freeDate },
    ],
    lists: [{ title: t.pauseTitle, items: pauseLines(language, v.impact) }],
    button: { label: t.button, url: v.keepUrl },
    notes: [t.safe, fill(t.changedMind, names), t.timeZone],
  });
  return { subject: fill(t.subject, names), html, text };
}
