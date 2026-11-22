const MINUTE_MS = 60_000

/**
 * Days / hours / minutes until `endsAt`, never negative (sale countdown).
 * Minutes are rounded up, so "0 minutes" only shows once it has ended.
 */
export function timeLeft(endsAt: number, now: number): { days: number; hours: number; minutes: number; ended: boolean } {
  const ms = Math.max(0, endsAt - now)
  const totalMinutes = Math.ceil(ms / MINUTE_MS)
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
    ended: ms === 0,
  }
}

/**
 * Days / hours / minutes / seconds until `endsAt`, never negative: the
 * live countdown's display. Seconds are rounded up, so "0s" only shows
 * once it has ended. (`timeLeft` stays the minute-precise spoken value.)
 */
export function clockLeft(
  endsAt: number,
  now: number,
): { days: number; hours: number; minutes: number; seconds: number; ended: boolean } {
  const ms = Math.max(0, endsAt - now)
  const total = Math.ceil(ms / 1000)
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    ended: ms === 0,
  }
}
