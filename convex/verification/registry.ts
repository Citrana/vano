import { logSender } from "./log";
import type { CodeSender, SenderId } from "./sender";

/**
 * Which sender delivers WhatsApp verification codes, from deployment env
 * vars (`npx convex env set`, never from the UI):
 *
 *   VERIFICATION_SENDER      "log" (later "whatsapp", …). Unset = sending off,
 *                            requests for a new number can't be made.
 *   VERIFICATION_TEST_MODE   "true" with the log sender: the code is also
 *                            returned to the browser and shown on screen.
 *                            Never set it on the production deployment.
 */
const SENDERS: Record<SenderId, CodeSender> = {
  log: logSender,
};

export function activeSender(): CodeSender | null {
  const id = process.env.VERIFICATION_SENDER;
  return id !== undefined && id in SENDERS ? SENDERS[id as SenderId] : null;
}

/** True only when codes may be shown on screen (log sender + explicit flag). */
export function verificationTestMode(): boolean {
  return process.env.VERIFICATION_SENDER === "log" && process.env.VERIFICATION_TEST_MODE === "true";
}
