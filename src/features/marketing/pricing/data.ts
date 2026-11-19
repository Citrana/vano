import "server-only"
import { fetchQuery } from "convex/nextjs"
import { cache } from "react"
import { api } from "../../../../convex/_generated/api"
import type { PlanCatalog } from "../../../../convex/lib/planCatalog"

/**
 * The plan catalogue for server-rendered marketing pages (pricing, home,
 * features, share images), from the live plan config edited on the admin
 * "Plans & features" page. Deduplicated per request.
 */
export const getPlanCatalog = cache(async (): Promise<PlanCatalog> => {
  // The query returns plain keys; they are the catalogue's own feature keys.
  return (await fetchQuery(api.plans.catalog, {})) as PlanCatalog
})
