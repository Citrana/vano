import type { NotificationChannel } from "./channel";

/** Development channel: writes the message to the Convex log. */
export const logChannel: NotificationChannel = {
  id: "log",
  async send(message) {
    console.log(
      `[notification] ${message.kind} for "${message.shopName}" (${message.field} → ${message.newValue})` +
        (message.reason ? `: ${message.reason}` : ""),
    );
  },
};
