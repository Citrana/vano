import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { trialReminderEmail } from "./emails/trialReminders";
import { sendEmail } from "./emails/send";
import { normalizeEmail } from "./lib/credentials";
import { utcDay } from "./lib/days";
import { DAY_MS } from "./lib/plans";
import { stateOf } from "./lib/subscriptions";
import {
  ENDED_EMAIL_WINDOW_DAYS,
  FIRST_REMINDER_DAYS,
  TRIAL_EMAILS_PER_DAY,
  TRIAL_EMAIL_SPACING_MS,
  byPriority,
  dueTrialEmail,
  sameDue,
  trialEmailKindValidator,
  type DueTrialEmail,
  type SentTrialEmail,
} from "./lib/trialEmails";

/**
 * Trial reminder emails (convex/crons.ts, CLAUDE.md "Emails"; rules in
 * convex/lib/trialEmails.ts).
 *
 * plan (daily, 06:00 UTC = 09:00 Nairobi): finds the shops with a reminder
 * due, most urgent first, and schedules one `send` per shop a minute apart,
 * within what's left of the day's `TRIAL_EMAILS_PER_DAY`. Shops past the
 * limit have no record, so the next run picks them up first.
 *
 * send: checks everything again against the subscription as it is now
 * (paid, upgraded, granted, extended or already sent → nothing) and the
 * daily limit, then schedules the email and records it in the same
 * transaction. Each send is its own mutation: one failing never affects
 * the others, and a failed one is simply due again the next day.
 */

/** Candidates read per run and per kind of query (far above the daily limit). */
const CANDIDATES = 500;

async function sentToShop(ctx: MutationCtx, shopId: Id<"shops">): Promise<SentTrialEmail[]> {
  const rows = await ctx.db
    .query("trialEmails")
    .withIndex("by_shopId_and_kind_and_trialEnd", (q) => q.eq("shopId", shopId))
    .take(50);
  return rows.map((r) => ({ kind: r.kind, trialEnd: r.trialEnd }));
}

async function sentOn(ctx: MutationCtx, day: string): Promise<number> {
  const rows = await ctx.db
    .query("trialEmails")
    .withIndex("by_day", (q) => q.eq("day", day))
    .take(TRIAL_EMAILS_PER_DAY);
  return rows.length;
}

/** The shop and its owner, when an email may go to them at all. */
async function reachable(
  ctx: MutationCtx,
  shopId: Id<"shops">,
): Promise<{ shop: Doc<"shops">; owner: Doc<"users"> } | null> {
  const shop = await ctx.db.get("shops", shopId);
  if (!shop || shop.status === "suspended") return null;
  const owner = await ctx.db.get("users", shop.ownerId);
  if (!owner || owner.status === "suspended") return null;
  return { shop, owner };
}

export const plan = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const budget = TRIAL_EMAILS_PER_DAY - (await sentOn(ctx, utcDay(now)));
    if (budget <= 0) return 0;

    const ending = await ctx.db
      .query("subscriptions")
      .withIndex("by_status_and_periodEnd", (q) =>
        q.eq("status", "trialing").gt("periodEnd", now).lte("periodEnd", now + FIRST_REMINDER_DAYS * DAY_MS),
      )
      .take(CANDIDATES);
    const ended = await ctx.db
      .query("subscriptions")
      .withIndex("by_status_and_trialEndedAt", (q) =>
        q.eq("status", "free").gte("trialEndedAt", now - ENDED_EMAIL_WINDOW_DAYS * DAY_MS).lte("trialEndedAt", now),
      )
      .take(CANDIDATES);

    const due: (DueTrialEmail & { shopId: Id<"shops"> })[] = [];
    for (const sub of [...ending, ...ended]) {
      if (!(await reachable(ctx, sub.shopId))) continue;
      const next = dueTrialEmail(stateOf(sub), await sentToShop(ctx, sub.shopId), now);
      if (next) due.push({ ...next, shopId: sub.shopId });
    }

    const chosen = byPriority(due).slice(0, budget);
    for (const [i, { shopId, kind, trialEnd }] of chosen.entries()) {
      await ctx.scheduler.runAfter(i * TRIAL_EMAIL_SPACING_MS, internal.trialEmailJobs.send, { shopId, kind, trialEnd });
    }
    return chosen.length;
  },
});

export const send = internalMutation({
  args: { shopId: v.id("shops"), kind: trialEmailKindValidator, trialEnd: v.number() },
  returns: v.boolean(),
  handler: async (ctx, { shopId, kind, trialEnd }) => {
    const now = Date.now();
    const found = await reachable(ctx, shopId);
    if (!found) return false;
    const { shop, owner } = found;
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_shopId", (q) => q.eq("shopId", shopId))
      .unique();
    if (!sub) return false;
    const state = stateOf(sub);
    // Paid, upgraded, granted, dates changed or already sent: not this email any more.
    if (!sameDue(dueTrialEmail(state, await sentToShop(ctx, shopId), now), { kind, trialEnd })) return false;

    const day = utcDay(now);
    if ((await sentOn(ctx, day)) >= TRIAL_EMAILS_PER_DAY) return false;
    const to = normalizeEmail(owner.email);
    if (to === null) return false;
    const siteUrl = process.env.SITE_URL?.replace(/\/+$/, "");
    if (!siteUrl) {
      console.warn("[email] SITE_URL is not set: trial reminder skipped (due again next run)");
      return false;
    }

    await sendEmail(ctx, { to, ...(await trialReminderEmail(ctx, shop, state, kind, { siteUrl, now })) });
    await ctx.db.insert("trialEmails", { shopId, kind, trialEnd, day, sentAt: now });
    return true;
  },
});
