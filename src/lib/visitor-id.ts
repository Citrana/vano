"use client"

import { useState } from "react"

const KEY = "vano:visitor"

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

/**
 * A random id for this browser (CLAUDE.md "Discount codes"): it keys the
 * wrong-code limits and counts a code use once per visitor and product.
 * Nothing personal; storage can be blocked (private mode), so it falls
 * back to an id for this page view.
 */
export function readVisitorId(): string {
  try {
    const saved = window.localStorage.getItem(KEY)
    if (saved && /^[A-Za-z0-9_-]{8,64}$/.test(saved)) return saved
    const id = randomId()
    window.localStorage.setItem(KEY, id)
    return id
  } catch {
    return randomId()
  }
}

/** The visitor id, read once on the client (call it from event handlers only). */
export function useVisitorId(): () => string {
  const [cache] = useState<{ id?: string }>(() => ({}))
  return () => (cache.id ??= readVisitorId())
}
