import type { NotificationChannel } from "./channel";

/** Development channel: writes the notification to the Convex log (no contact details). */
export const logChannel: NotificationChannel = {
  id: "log",
  async send({ data, recipient }) {
    const { type, ...values } = data;
    console.log(`[notification] ${type} (${recipient.language}) ${JSON.stringify(values)}`);
  },
};
