const SECOND = 1000;
const MINUTE = 60 * SECOND;

/** Attempts per email, the first one included. */
export const EMAIL_MAX_ATTEMPTS = 5;

/** Wait before retry n (after attempt n failed); the last value repeats. */
export const EMAIL_RETRY_DELAYS_MS = [30 * SECOND, 2 * MINUTE, 10 * MINUTE, 30 * MINUTE] as const;

export function retryDelay(failedAttempt: number): number {
  return EMAIL_RETRY_DELAYS_MS[Math.min(failedAttempt, EMAIL_RETRY_DELAYS_MS.length - 1)];
}
