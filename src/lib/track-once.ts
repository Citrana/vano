/**
 * Runs `send` once per browser session per key (CLAUDE.md "Stats"), so a
 * refresh doesn't inflate view counts. Storage may be unavailable
 * (private mode): then it just sends.
 */
export function trackOnce(key: string, send: () => unknown): void {
  const storageKey = `vano:seen:${key}`
  try {
    if (window.sessionStorage.getItem(storageKey)) return
    window.sessionStorage.setItem(storageKey, "1")
  } catch {
    // ignore
  }
  void Promise.resolve()
    .then(send)
    .catch(() => {})
}
