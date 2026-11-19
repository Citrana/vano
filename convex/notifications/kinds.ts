import { v, type Infer } from "convex/values";

/** What a seller notification is about (labels: `Notifications.<kind>`). */
export const notificationKindValidator = v.union(
  v.literal("changeRequest.approved"),
  v.literal("changeRequest.rejected"),
);
export type NotificationKind = Infer<typeof notificationKindValidator>;
