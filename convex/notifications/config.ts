/**
 * Notification settings (CLAUDE.md "Notifications"): the one place for
 * retention, list sizes and the "needs attention" windows.
 */

/** Notifications older than this are deleted by `notificationJobs.cleanup` (read or not). */
export const NOTIFICATION_RETENTION_DAYS = 90;

/** How many notifications the bell's dropdown shows. */
export const INBOX_PREVIEW = 8;

/** Counts stop here and show "99+" (bell, sidebar badges, attention cards). */
export const COUNT_CAP = 99;

/** A failed payment needs attention for this many days, unless the shop paid since. */
export const FAILED_PAYMENT_WINDOW_DAYS = 7;
