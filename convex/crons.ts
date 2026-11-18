import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/** Recurring jobs (CLAUDE.md "Billing"). */
const crons = cronJobs();

// Trials and paid plans that ended move to Free.
crons.interval("expire ended plans", { hours: 1 }, internal.billingJobs.expireDue, {});

export default crons;
