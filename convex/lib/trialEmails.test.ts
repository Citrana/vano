import { describe, expect, test } from "vitest";
import { DAY_MS } from "./plans";
import type { SubscriptionState } from "./subscriptions";
import { byPriority, dueTrialEmail, sameDue } from "./trialEmails";

const NOW = Date.parse("2026-11-26T06:00:00Z");
const HOUR = 3_600_000;
const trial = (endIn: number): SubscriptionState => ({
  plan: "pro",
  status: "trialing",
  periodStart: NOW - 30 * DAY_MS,
  periodEnd: NOW + endIn,
});
const freeAfterTrial = (endedAgo: number): SubscriptionState => ({
  plan: "free",
  status: "free",
  periodStart: NOW - endedAgo,
  periodEnd: null,
  trialEndedAt: NOW - endedAgo,
});

describe("dueTrialEmail", () => {
  test("7-day email from 7 down to 3 days left, 2-day email at 2 and 1", () => {
    expect(dueTrialEmail(trial(8 * DAY_MS), [], NOW)).toBeNull();
    expect(dueTrialEmail(trial(7 * DAY_MS), [], NOW)).toEqual({ kind: "days7", trialEnd: NOW + 7 * DAY_MS });
    expect(dueTrialEmail(trial(6 * DAY_MS + HOUR), [], NOW)?.kind).toBe("days7");
    expect(dueTrialEmail(trial(3 * DAY_MS), [], NOW)?.kind).toBe("days7");
    expect(dueTrialEmail(trial(2 * DAY_MS), [], NOW)).toEqual({ kind: "days2", trialEnd: NOW + 2 * DAY_MS });
    expect(dueTrialEmail(trial(HOUR), [], NOW)?.kind).toBe("days2");
    expect(dueTrialEmail(trial(-HOUR), [], NOW)).toBeNull();
  });

  test("each email once per trial end; a late 7-day email is dropped for the 2-day one", () => {
    const end = NOW + 5 * DAY_MS;
    expect(dueTrialEmail(trial(5 * DAY_MS), [{ kind: "days7", trialEnd: end }], NOW)).toBeNull();
    const end2 = NOW + 2 * DAY_MS;
    expect(dueTrialEmail(trial(2 * DAY_MS), [{ kind: "days7", trialEnd: end2 }], NOW)?.kind).toBe("days2");
    expect(dueTrialEmail(trial(2 * DAY_MS), [{ kind: "days2", trialEnd: end2 }], NOW)).toBeNull();
  });

  test("an extended trial follows its new end date", () => {
    const oldEnd = NOW - DAY_MS;
    const sent = [
      { kind: "days7" as const, trialEnd: oldEnd },
      { kind: "days2" as const, trialEnd: oldEnd },
    ];
    expect(dueTrialEmail(trial(10 * DAY_MS), sent, NOW)).toBeNull();
    expect(dueTrialEmail(trial(7 * DAY_MS), sent, NOW)).toEqual({ kind: "days7", trialEnd: NOW + 7 * DAY_MS });
  });

  test("ended: only a Free that came from a trial, within 7 days, once", () => {
    expect(dueTrialEmail(freeAfterTrial(HOUR), [], NOW)).toEqual({ kind: "ended", trialEnd: NOW - HOUR });
    expect(dueTrialEmail(freeAfterTrial(7 * DAY_MS), [], NOW)?.kind).toBe("ended");
    expect(dueTrialEmail(freeAfterTrial(7 * DAY_MS + 1), [], NOW)).toBeNull();
    expect(dueTrialEmail(freeAfterTrial(HOUR), [{ kind: "ended", trialEnd: 1 }], NOW)).toBeNull();
    // "Get Business" sign-ups start on Free without a trial.
    expect(dueTrialEmail({ plan: "free", status: "free", periodStart: NOW - HOUR, periodEnd: null }, [], NOW)).toBeNull();
  });

  test("paid, granted, Business or lapsed plans get nothing", () => {
    const end = NOW + 2 * DAY_MS;
    expect(dueTrialEmail({ plan: "pro", status: "active", periodStart: NOW, periodEnd: end }, [], NOW)).toBeNull();
    expect(dueTrialEmail({ plan: "business", status: "active", periodStart: NOW, periodEnd: end }, [], NOW)).toBeNull();
    expect(dueTrialEmail({ plan: "free", status: "expired", periodStart: NOW, periodEnd: null }, [], NOW)).toBeNull();
  });
});

describe("byPriority / sameDue", () => {
  test("2-day first, then ended, then 7-day; nearest date first", () => {
    const list = [
      { kind: "days7" as const, trialEnd: 5 },
      { kind: "ended" as const, trialEnd: 9 },
      { kind: "days2" as const, trialEnd: 8 },
      { kind: "days2" as const, trialEnd: 3 },
    ];
    expect(byPriority(list).map((c) => `${c.kind}:${c.trialEnd}`)).toEqual(["days2:3", "days2:8", "ended:9", "days7:5"]);
  });
  test("sameDue compares kind and trial end", () => {
    expect(sameDue({ kind: "days7", trialEnd: 1 }, { kind: "days7", trialEnd: 1 })).toBe(true);
    expect(sameDue({ kind: "days7", trialEnd: 2 }, { kind: "days7", trialEnd: 1 })).toBe(false);
    expect(sameDue(null, { kind: "days7", trialEnd: 1 })).toBe(false);
  });
});
