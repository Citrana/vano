"use client"

import { useEffect, useState } from "react"

/**
 * Seconds left before "Resend code" works again. `start(seconds)` begins a
 * wait (after each send, or a longer one after too many wrong codes).
 */
export function useResendCooldown(initialSeconds = 0) {
  const [until, setUntil] = useState(() => (initialSeconds > 0 ? Date.now() + initialSeconds * 1000 : 0))
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (until <= Date.now()) return
    const timer = setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= until) clearInterval(timer)
    }, 250)
    return () => clearInterval(timer)
  }, [until])

  return {
    secondsLeft: Math.max(0, Math.ceil((until - now) / 1000)),
    start: (seconds: number) => {
      const current = Date.now()
      setNow(current)
      setUntil(current + seconds * 1000)
    },
  }
}
