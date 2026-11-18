import type { ChannelId, NotificationChannel } from "./channel";
import { logChannel } from "./log";

/**
 * Outside channels that also receive seller notifications, from the
 * `NOTIFY_CHANNELS` deployment env var: a comma-separated list of ids
 * ("log"; later "whatsapp", "email"). Unset = in-app only.
 */
const CHANNELS: Record<ChannelId, NotificationChannel> = {
  log: logChannel,
};

export function activeChannels(): NotificationChannel[] {
  const ids = (process.env.NOTIFY_CHANNELS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id): id is ChannelId => id in CHANNELS);
  return [...new Set(ids)].map((id) => CHANNELS[id]);
}
