/**
 * The one interface a verification-code sender implements. Adding a real
 * WhatsApp provider means: a file implementing it, its id in `SenderId`,
 * and a line in registry.ts. Nothing else changes.
 */
export type SenderId = "log";

export interface CodeSender {
  readonly id: SenderId;
  /** Sends `code` to `phone` (E.164). Runs in an action (may call HTTP). */
  send(phone: string, code: string): Promise<void>;
}
