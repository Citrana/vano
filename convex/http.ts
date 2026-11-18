import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { providerById } from "./payments/registry";

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * Payment provider webhooks: POST /payments/callback/<provider>. The
 * provider verifies the request (`parseCallback`); anything it rejects is
 * a 400 and changes nothing. Accepted results go through `applyResult`,
 * which ignores duplicates (CLAUDE.md "Billing"). The mock has no webhooks.
 */
http.route({
  pathPrefix: "/payments/callback/",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const id = new URL(request.url).pathname.split("/").pop() ?? "";
    const provider = providerById(id);
    if (!provider) return new Response("Unknown provider", { status: 404 });
    const event = await provider.parseCallback(request);
    if (!event) return new Response("Rejected", { status: 400 });
    await ctx.runMutation(internal.payments.core.applyResult, { provider: provider.id, event });
    return new Response(null, { status: 200 });
  }),
});

export default http;
