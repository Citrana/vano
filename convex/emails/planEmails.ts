import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { normalizeEmail } from "../lib/credentials";
import { addedFeatures, catalogOf } from "../lib/planCatalog";
import { readPlanConfig } from "../lib/planConfig";
import { formatBillingDate, receiptKind } from "../lib/planEmails";
import { PERIOD_DAYS, formatPlanPrice, isPaidPlan } from "../lib/plans";
import { shopDowngradeImpact } from "../lib/shopDowngrade";
import { effectivePlan, pricesOf, stateAt, type SubscriptionState } from "../lib/subscriptions";
import { maskEmail } from "./address";
import { sendEmail } from "./send";
import { planDowngradeEmail, planReceiptEmail } from "./templates/planEmails";

/**
 * Plan emails (CLAUDE.md "Emails", docs/payments.md section 15), to the
 * shop's owner in the shop's language:
 * - the receipt, from `payments/core.applyEvent` in the transaction that
 *   applies a confirmed payment (never for failed / cancelled / expired
 *   results, never for admin grants or extensions);
 * - the downgrade confirmation, from `billing.scheduleDowngrade`.
 *
 * Each goes once: the record's marker (`payments.receiptEmailAt`,
 * `planChanges.emailSentAt`) is set in the same transaction. Neither ever
 * throws: a missing owner, address or `SITE_URL` skips the email, and
 * delivery runs later (`sendEmail` only schedules it), so the payment or
 * the plan change always goes through.
 */

function siteUrl(): string | null {
  return process.env.SITE_URL?.replace(/\/+$/, "") || null;
}

async function ownerAddress(ctx: MutationCtx, shop: Doc<"shops">): Promise<string | null> {
  const owner = await ctx.db.get("users", shop.ownerId);
  return owner ? normalizeEmail(owner.email) : null;
}

export async function sendPaymentReceipt(
  ctx: MutationCtx,
  {
    payment,
    shop,
    previous,
    next,
    now,
  }: { payment: Doc<"payments">; shop: Doc<"shops">; previous: SubscriptionState; next: SubscriptionState; now: number },
): Promise<void> {
  if (payment.receiptEmailAt !== undefined || !isPaidPlan(payment.plan) || next.periodEnd === null) return;
  let to: string | null = null;
  try {
    to = await ownerAddress(ctx, shop);
    const site = siteUrl();
    if (to === null) return;
    if (site === null) {
      console.warn("[email] SITE_URL is not set: payment receipt skipped");
      return;
    }
    const language = shop.language;
    const config = await readPlanConfig(ctx);
    const before = stateAt(previous, now);
    const { kind, trial } = receiptKind(before, payment.plan, now, pricesOf(config));
    const name = (plan: Doc<"payments">["plan"]) => config.plans[plan].name[language];
    const credit = payment.creditMinor ?? 0;
    await sendEmail(ctx, {
      to,
      ...planReceiptEmail(language, {
        kind,
        planName: name(next.plan),
        amount: formatPlanPrice(payment.amountMinor, language),
        credit: credit > 0 ? { amount: formatPlanPrice(credit, language), planName: name(before.plan) } : null,
        paidOn: formatBillingDate(payment.completedAt ?? now, language),
        reference: payment.providerRef ?? payment._id,
        newEnd: formatBillingDate(next.periodEnd, language),
        unlocks:
          kind === "upgrade"
            ? addedFeatures(catalogOf(config), effectivePlan(before), next.plan, language).map((line) => line.label)
            : [],
        trial,
        url: `${site}/dashboard/billing`,
      }),
    });
    await ctx.db.patch("payments", payment._id, { receiptEmailAt: now });
  } catch (error) {
    console.error(`[email] payment receipt to ${to ? maskEmail(to) : "the owner"} not sent: ${String(error)}`);
  }
}

export async function sendDowngradeEmail(
  ctx: MutationCtx,
  { change, shop, now }: { change: Doc<"planChanges">; shop: Doc<"shops">; now: number },
): Promise<void> {
  if (change.emailSentAt !== undefined) return;
  let to: string | null = null;
  try {
    to = await ownerAddress(ctx, shop);
    const site = siteUrl();
    if (to === null) return;
    if (site === null) {
      console.warn("[email] SITE_URL is not set: downgrade confirmation skipped");
      return;
    }
    const language = shop.language;
    const config = await readPlanConfig(ctx);
    const { impact } = await shopDowngradeImpact(ctx, shop, change.toPlan, now);
    const price = config.plans[change.toPlan].monthlyMinor;
    await sendEmail(ctx, {
      to,
      ...planDowngradeEmail(language, {
        planName: config.plans[change.fromPlan].name[language],
        targetName: config.plans[change.toPlan].name[language],
        freeName: config.plans.free.name[language],
        date: formatBillingDate(change.effectiveAt, language),
        freeDate: formatBillingDate(change.freeAt, language),
        target: isPaidPlan(change.toPlan)
          ? { paid: true, price: price !== null && price > 0 ? formatPlanPrice(price, language) : null, days: PERIOD_DAYS }
          : { paid: false },
        impact,
        keepUrl: `${site}/dashboard/billing?keep=${change._id}`,
      }),
    });
    await ctx.db.patch("planChanges", change._id, { emailSentAt: now });
  } catch (error) {
    console.error(`[email] downgrade confirmation to ${to ? maskEmail(to) : "the owner"} not sent: ${String(error)}`);
  }
}
