import aggregate from "@convex-dev/aggregate/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import { defineApp } from "convex/server";

/**
 * Components. The aggregate instances keep the platform-wide counters used
 * by the admin dashboard (`convex/lib/platformStats.ts`). The rate limiter
 * throttles WhatsApp verification codes (`convex/lib/rateLimits.ts`).
 */
const app = defineApp();
app.use(aggregate, { name: "usersByCreation" });
app.use(aggregate, { name: "shopsByCreation" });
app.use(aggregate, { name: "productsByCreation" });
app.use(aggregate, { name: "clicksByDay" });
app.use(rateLimiter);
export default app;
