import type { Language } from "../lib/catalog";
import type { ProtectedField } from "../lib/changeRequests";
import type { NotificationKind } from "./kinds";

/**
 * The one interface an outside notification channel implements (WhatsApp,
 * email…). Adding one: a file implementing it, its id in `ChannelId`, and
 * a line in registry.ts. In-app notifications need no channel: the
 * `sellerNotifications` row is shown in the dashboard.
 */
export type ChannelId = "log";

export type SellerMessage = {
  kind: NotificationKind;
  /** Where to reach the seller. */
  email: string | null;
  whatsappNumber: string;
  /** The shop's language, for the message text. */
  language: Language;
  shopName: string;
  field: ProtectedField;
  newValue: string;
  /** The admin's reason, for a rejection. */
  reason: string | null;
};

export interface NotificationChannel {
  readonly id: ChannelId;
  /** Runs in an action (may call HTTP). Throwing only logs the failure. */
  send(message: SellerMessage): Promise<void>;
}
