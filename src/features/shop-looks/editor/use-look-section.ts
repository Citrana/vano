"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { parseSection } from "./section-state"

const STORAGE_KEY = "vano.look.section"

function readRemembered(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null // private mode, blocked storage…
  }
}

/**
 * The open "Shop look" section, in the page address (`?section=banner`):
 * refresh, shared links and Back / Forward work. Without one, the section
 * last opened on this device (a convenience only), else the first.
 */
export function useLookSection<K extends string>(keys: readonly K[]) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [remembered] = useState(readRemembered)
  const fromUrl = params.get("section")
  const section = parseSection(fromUrl, keys, remembered)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, section)
    } catch {
      // Not remembered; nothing else depends on it.
    }
  }, [section])

  const select = useCallback(
    (next: K) => {
      if (next === section && fromUrl === next) return
      const query = new URLSearchParams(params.toString())
      query.set("section", next)
      // A history entry per section, so Back returns to the previous one.
      router.push(`${pathname}?${query.toString()}`, { scroll: false })
    },
    [section, fromUrl, params, pathname, router],
  )

  return { section, select, inUrl: fromUrl !== null && (keys as readonly string[]).includes(fromUrl) }
}
