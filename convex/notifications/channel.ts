import type { Language } from "../lib/catalog";
import type { NotificationData } from "./types";

/**
 * The one interface an outside notification channel implements (WhatsApp,
 * email…). Adding one: a file implementing it, its id in `ChannelId`, and
 * a line in registry.ts. Features never change: they call `notify`
 * (convex/lib/notify.ts), and the row it writes is the in-app delivery.
 */
export type ChannelId = "log";

export type OutgoingNotification = {
  /** What happened, with the values the text needs (type-specific). */
  data: NotificationData;
  recipient: {
    email: string | null;
    /** The recipient's shop WhatsApp number, when they have a shop. */
    whatsappNumber: string | null;
    /** Their shop's language; "en" for someone without a shop. */
    language: Language;
  };
};

export interface NotificationChannel {
  readonly id: ChannelId;
  /** Runs in an action (may call HTTP). Throwing only logs the failure. */
  send(message: OutgoingNotification): Promise<void>;
}
