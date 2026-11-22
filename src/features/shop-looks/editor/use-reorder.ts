"use client"

import { useEffect, useRef, useState, type PointerEvent } from "react"

/**
 * Drag to reorder a vertical list with a handle (mouse, touch and pen,
 * via pointer events; no library). Rows carry `data-reorder-row`; the
 * handle gets `handleProps(index)`. The list moves live while dragging
 * (`onMove(from, to)`). Keyboard and screen reader users use the rows'
 * up / down buttons instead.
 *
 * The pointer is followed on `window` (not with pointer capture): moving
 * a row in the DOM would drop the capture mid-drag.
 */
export function useReorder(onMove: (from: number, to: number) => void) {
  const listRef = useRef<HTMLOListElement>(null)
  const current = useRef<number | null>(null)
  const moveRef = useRef(onMove)
  const cleanup = useRef<(() => void) | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)

  useEffect(() => {
    moveRef.current = onMove
  }, [onMove])
  useEffect(() => () => cleanup.current?.(), [])

  function onPointerMove(event: globalThis.PointerEvent) {
    const from = current.current
    if (from === null || !listRef.current) return
    const rows = [...listRef.current.querySelectorAll<HTMLElement>("[data-reorder-row]")]
    let to = rows.length - 1
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect()
      if (event.clientY < rect.top + rect.height / 2) {
        to = i
        break
      }
    }
    if (to !== from) {
      moveRef.current(from, to)
      current.current = to
      setDragging(to)
    }
  }

  function end() {
    cleanup.current?.()
    current.current = null
    setDragging(null)
  }

  function handleProps(index: number) {
    return {
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (event.button !== 0) return
        event.preventDefault()
        current.current = index
        setDragging(index)
        window.addEventListener("pointermove", onPointerMove)
        window.addEventListener("pointerup", end)
        window.addEventListener("pointercancel", end)
        cleanup.current = () => {
          window.removeEventListener("pointermove", onPointerMove)
          window.removeEventListener("pointerup", end)
          window.removeEventListener("pointercancel", end)
          cleanup.current = null
        }
      },
      style: { touchAction: "none" } as const,
    }
  }

  return { listRef, dragging, handleProps }
}
