import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { fail } from "./errors";
import { DEFAULT_PLAN_CONFIG } from "./planDefaults";
import {
  FEATURE_KEYS,
  featureValueProblem,
  isFeatureKey,
  planConfigProblem,
  type ExceptionGrant,
  type FeatureValue,
  type PlanConfigData,
} from "./planFeatures";
import { PLAN_IDS, type PlanId } from "./plans";

/**
 * The live plan configuration (CLAUDE.md "Billing"): one `planConfig`
 * document, edited on the admin "Plans & features" page. Every plan check
 * (`entitlements.ts`), checkout amount, trial length and the pricing page
 * read it through `readPlanConfig`. `writePlanConfig` is its only writer.
 *
 * A missing document (a fresh deployment before `migrations:plansV1`) or a
 * feature key added later falls back to the seed (`planDefaults.ts`), so
 * nothing changes for existing shops and no manual step is needed.
 */

type StoredConfig = Pick<Doc<"planConfig">, "plans" | "features">;

/** Stored values over the seed; a value of the wrong kind falls back too. */
export function mergeConfig(stored: StoredConfig | null): PlanConfigData {
  if (!stored) return DEFAULT_PLAN_CONFIG;
  const features = {} as PlanConfigData["features"];
  for (const key of FEATURE_KEYS) {
    const fallback = DEFAULT_PLAN_CONFIG.features[key];
    const saved = stored.features[key];
    if (!saved) {
      features[key] = fallback;
      continue;
    }
    const values = {} as Record<PlanId, FeatureValue>;
    for (const id of PLAN_IDS) {
      values[id] = featureValueProblem(key, saved.values[id]) === null ? saved.values[id] : fallback.values[id];
    }
    features[key] = { values, pricing: saved.pricing };
  }
  return { plans: stored.plans, features };
}

export type PlanConfigView = PlanConfigData & { version: number; updatedAt: number | null };

async function configDoc(ctx: QueryCtx): Promise<Doc<"planConfig"> | null> {
  return await ctx.db.query("planConfig").first();
}

export async function readPlanConfig(ctx: QueryCtx): Promise<PlanConfigView> {
  const doc = await configDoc(ctx);
  return { ...mergeConfig(doc), version: doc?.version ?? 0, updatedAt: doc?.updatedAt ?? null };
}

/**
 * Saves the whole configuration. `expectedVersion` is the version the
 * admin edited: if someone saved in between, PLAN_CONFIG_STALE (the second
 * admin is warned and reloads). Returns the new version.
 */
export async function writePlanConfig(
  ctx: MutationCtx,
  next: PlanConfigData,
  expectedVersion: number,
  actorId: Id<"users"> | null,
): Promise<number> {
  const doc = await configDoc(ctx);
  const current = doc?.version ?? 0;
  if (current !== expectedVersion) fail("PLAN_CONFIG_STALE");
  if (planConfigProblem(next) !== null) fail("PLAN_CONFIG_INVALID");
  const fields = {
    version: current + 1,
    updatedAt: Date.now(),
    updatedBy: actorId ?? undefined,
    plans: next.plans,
    features: next.features,
  };
  if (doc) await ctx.db.replace("planConfig", doc._id, fields);
  else await ctx.db.insert("planConfig", fields);
  return fields.version;
}

/** Inserts the seed if there's no config yet (idempotent). */
export async function seedPlanConfig(ctx: MutationCtx): Promise<boolean> {
  if (await configDoc(ctx)) return false;
  await ctx.db.insert("planConfig", {
    version: 1,
    updatedAt: Date.now(),
    plans: DEFAULT_PLAN_CONFIG.plans,
    features: DEFAULT_PLAN_CONFIG.features,
  });
  return true;
}

// ---------------------------------------------------------------------------
// Shop exceptions

/** How many live exceptions a shop can have at once. */
export const MAX_SHOP_EXCEPTIONS = 20;


/**
 * The shop's live exceptions. Queries pass no `now` and trust the stored
 * `active` flag (cleared by `planExceptionJobs.expire` at `endsAt`);
 * mutations pass `now` so an exception past its end never counts.
 */
export async function activeExceptions(
  ctx: QueryCtx,
  shopId: Id<"shops">,
  now?: number,
): Promise<ExceptionGrant[]> {
  const rows = await ctx.db
    .query("planExceptions")
    .withIndex("by_shopId_and_active", (q) => q.eq("shopId", shopId).eq("active", true))
    .take(MAX_SHOP_EXCEPTIONS);
  return rows.flatMap((row) =>
    (now === undefined || row.endsAt > now) && isFeatureKey(row.feature)
      ? [{ feature: row.feature, value: row.value }]
      : [],
  );
}
