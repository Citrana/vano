import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * History of admin actions (who did what, to whom, when). Every admin
 * mutation calls `logAdminAction` in the same transaction as its write, so
 * the log can never miss a change or record one that rolled back.
 * Labels: `AuditActions.<action>` in `messages/*.json`.
 */
export const AUDIT_ACTIONS = [
  "user.suspend",
  "user.reactivate",
  "user.assignRole",
  "shop.suspend",
  "shop.reactivate",
  "shop.delete",
  "product.hide",
  "product.unhide",
  "product.delete",
  "role.create",
  "role.update",
  "role.delete",
  "settings.update",
  "superAdmin.seed",
] as const;

export const auditActionValidator = v.union(
  v.literal("user.suspend"),
  v.literal("user.reactivate"),
  v.literal("user.assignRole"),
  v.literal("shop.suspend"),
  v.literal("shop.reactivate"),
  v.literal("shop.delete"),
  v.literal("product.hide"),
  v.literal("product.unhide"),
  v.literal("product.delete"),
  v.literal("role.create"),
  v.literal("role.update"),
  v.literal("role.delete"),
  v.literal("settings.update"),
  v.literal("superAdmin.seed"),
);
export type AuditAction = Infer<typeof auditActionValidator>;

export const auditTargetTypeValidator = v.union(
  v.literal("user"),
  v.literal("shop"),
  v.literal("product"),
  v.literal("role"),
  v.literal("settings"),
);
export type AuditTargetType = Infer<typeof auditTargetTypeValidator>;

export const auditDetailsValidator = v.record(
  v.string(),
  v.union(v.string(), v.number(), v.boolean(), v.null()),
);
export type AuditDetails = Infer<typeof auditDetailsValidator>;

export async function logAdminAction(
  ctx: MutationCtx,
  entry: {
    /** Null for the terminal seed command. */
    actor: Doc<"users"> | null;
    action: AuditAction;
    targetType: AuditTargetType;
    targetId: string;
    /** Snapshot (email, shop or product name) so it survives deletion. */
    targetLabel: string;
    details?: AuditDetails;
  },
): Promise<void> {
  await ctx.db.insert("auditLogs", {
    actorId: entry.actor?._id,
    actorEmail: entry.actor ? (entry.actor.email ?? "") : "system",
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    targetLabel: entry.targetLabel,
    details: entry.details,
  });
}
