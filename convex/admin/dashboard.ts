import { v } from "convex/values";
import { adminQuery } from "../lib/access";
import { readPlatformStats } from "../lib/platformStats";

const growth = v.object({ signups: v.number(), shops: v.number() });

/**
 * Platform totals plus new sign-ups / shops over the last 7 and 30 days
 * (today included). `today` ("YYYY-MM-DD", UTC) comes from the client
 * because queries can't read the clock; an invalid day gives zero windows.
 * Counts only — no personal data.
 */
export const overview = adminQuery({
  permission: "dashboard.view",
  args: { today: v.string() },
  returns: v.object({
    totals: v.object({
      users: v.number(),
      shops: v.number(),
      products: v.number(),
      whatsappClicks: v.number(),
    }),
    last7: growth,
    last30: growth,
  }),
  handler: async (ctx, { today }) => await readPlatformStats(ctx, today),
});
