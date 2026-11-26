import { maskEmail } from "./address";
import type { EmailProvider } from "./provider";

/**
 * Development provider, used whenever Resend isn't configured: nothing
 * leaves the server, the email is written to the Convex logs instead.
 */
export const logProvider: EmailProvider = {
  id: "log",
  async send({ to, subject, text }) {
    console.log(`[email] (log mode, not sent) to ${maskEmail(to)}\nSubject: ${subject}\n\n${text}`);
    return { ok: true };
  },
};
