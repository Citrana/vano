"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

/** Old one-page anchors → their new pages (hashes never reach the server). */
const MOVED: Record<string, string> = {
  "#why": "/features",
  "#demo": "/demo",
  "#faq": "/help",
  "#pricing": "/pricing",
}

export function LegacyAnchorRedirect() {
  const router = useRouter()
  useEffect(() => {
    const target = MOVED[window.location.hash]
    if (target) router.replace(target)
  }, [router])
  return null
}
