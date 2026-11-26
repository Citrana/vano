import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { utcDay } from "../lib/days";
import { shopProducts } from "../lib/entitlements";
import { readPlanConfig } from "../lib/planConfig";
import { catalogOf, includedCardLines } from "../lib/planCatalog";
import { GRACE_DAYS, TRIAL_PLAN, daysLeft, formatPlanPrice } from "../lib/plans";
import { shopDowngradeImpact } from "../lib/shopDowngrade";
import { shopStatsTotals } from "../lib/statsTotals";
import type { SubscriptionState } from "../lib/subscriptions";
import { shopTimeZone } from "../lib/timeZone";
import type { TrialEmailKind } from "../lib/trialEmails";
import type { EmailContent } from "./send";
import { trialEndedEmail, trialLastDaysEmail, trialSoonEmail } from "./templates/trialReminders";

/**
 * Builds a trial reminder email (CLAUDE.md "Emails") from the shop's real
 * data, in the shop's language: plan names, the price and the Free limits
 * from the plan config, what would pause from `shopDowngradeImpact` (the
 * downgrade dialog's rule), views and clicks from the daily stats.
 * Called by `trialEmailJobs.send`, which decides whether it's due.
 */
export async function trialReminderEmail(
  ctx: QueryCtx,
  shop: Doc<"shops">,
  state: SubscriptionState,
  kind: TrialEmailKind,
  { siteUrl, now }: { siteUrl: string; now: number },
): Promise<EmailContent> {
  const language = shop.language;
  const config = await readPlanConfig(ctx);
  const common = {
    planName: config.plans[TRIAL_PLAN].name[language],
    freeName: config.plans.free.name[language],
    url: `${siteUrl}/dashboard/billing`,
  };
  if (kind === "ended") return trialEndedEmail(language, common);

  const end = state.periodEnd ?? now;
  const countdown = {
    days: daysLeft(end, now),
    date: new Intl.DateTimeFormat(language, { dateStyle: "long", timeZone: shopTimeZone(shop) }).format(end),
  };
  if (kind === "days7") {
    const totals = await shopStatsTotals(ctx, shop._id, utcDay(state.periodStart), utcDay(now));
    return trialSoonEmail(language, {
      ...common,
      ...countdown,
      built: {
        products: (await shopProducts(ctx, shop._id)).length,
        shopViews: totals.shopViews,
        whatsappClicks: totals.whatsappClicks,
      },
      keep: includedCardLines(catalogOf(config), "free", language).map((line) => line.label),
    });
  }

  const { impact, current, target } = await shopDowngradeImpact(ctx, shop, "free", now);
  const lost = (feature: (typeof current.features)[number]) =>
    current.features.includes(feature) && !target.features.includes(feature);

  const monthly = config.plans[TRIAL_PLAN].monthlyMinor;
  return trialLastDaysEmail(language, {
    ...common,
    ...countdown,
    graceDays: GRACE_DAYS,
    pauses: {
      offers: lost("salesPromotions") || lost("discountCodes"),
      looks: lost("allLooks"),
      stats: lost("shopStats"),
      productsHidden: impact.productsHidden,
      productLimit: target.products ?? 0,
    },
    price: monthly !== null && monthly > 0 ? formatPlanPrice(monthly, language) : null,
  });
}
