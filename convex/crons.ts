import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/** Recurring jobs (CLAUDE.md "Billing"). */
const crons = cronJobs();

// Trials and paid plans that ended move to Free.
crons.interval("expire ended plans", { hours: 1 }, internal.billingJobs.expireDue, {});

// Old open payments expire; stale pending ones are re-checked with the provider.
crons.interval("reconcile pending payments", { hours: 24 }, internal.payments.core.reconcilePending, {});

export default crons;
