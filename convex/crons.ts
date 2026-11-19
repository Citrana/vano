import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/** Recurring jobs (CLAUDE.md "Billing", "Protected shop changes", "Notifications"). */
const crons = cronJobs();

// Trials and paid plans that ended move to Free.
crons.interval("expire ended plans", { hours: 1 }, internal.billingJobs.expireDue, {});

// Old open payments expire; stale pending ones are re-checked with the provider.
crons.interval("reconcile pending payments", { hours: 24 }, internal.payments.core.reconcilePending, {});

// Old shop links stop redirecting (and become free); old verification codes go.
crons.interval("clean up change requests", { hours: 24 }, internal.changeRequestJobs.cleanup, {});

// Sellers whose trial / plan ends soon are warned; billing admins get a summary.
crons.interval("warn about ending plans", { hours: 24 }, internal.notificationJobs.endingSoon, {});

// Old notifications are deleted (retention in convex/notifications/config.ts).
crons.interval("clean up notifications", { hours: 24 }, internal.notificationJobs.cleanup, {});

export default crons;
