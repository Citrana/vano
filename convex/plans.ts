import { query } from "./_generated/server";
import { catalogOf } from "./lib/planCatalog";
import { readPlanConfig } from "./lib/planConfig";
import { catalogValidator } from "./lib/planValidators";

/**
 * The public plan catalogue (CLAUDE.md "Billing"): plan names, prices,
 * trial and what each plan includes, from the live plan config. Read by
 * the pricing page (server-rendered), the plan comparison, the seller's
 * plan options and upgrade notes. No personal data, no args.
 */
export const catalog = query({
  args: {},
  returns: catalogValidator,
  handler: async (ctx) => catalogOf(await readPlanConfig(ctx)),
});
