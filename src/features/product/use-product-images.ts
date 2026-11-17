"use client"

import { useCallback, useState } from "react"
import type { Id } from "../../../convex/_generated/dataModel"
import { LIMITS } from "../../../convex/lib/catalog"
import { useImageUpload } from "@/lib/use-image-upload"

export type ImageItem = {
  key: string
  url: string
  storageId?: Id<"_storage">
  status: "compressing" | "uploading" | "done" | "error"
  error?: "notAnImage" | "uploadFailed"
}

/** The product photo list: add (compress + upload), remove, set cover. */
export function useProductImages(initial: Array<{ storageId: Id<"_storage">; url: string | null }> = []) {
  const upload = useImageUpload()
  const [items, setItems] = useState<ImageItem[]>(() =>
    initial
      .filter((img): img is { storageId: Id<"_storage">; url: string } => img.url !== null)
      .map((img) => ({ key: img.storageId, url: img.url, storageId: img.storageId, status: "done" })),
  )

  const patch = useCallback((key: string, change: Partial<ImageItem>) => {
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...change } : item)))
  }, [])

  // Uploads start outside the state updater (updaters may run twice).
  const add = useCallback(
    (files: File[]) => {
      const room = LIMITS.maxImages - items.length
      const accepted = files.slice(0, Math.max(0, room)).map((file) => ({
        file,
        item: { key: crypto.randomUUID(), url: URL.createObjectURL(file), status: "compressing" as const },
      }))
      if (accepted.length === 0) return
      setItems((list) => [...list, ...accepted.map((a) => a.item)])
      for (const { file, item } of accepted) {
        upload(file, (stage) => patch(item.key, { status: stage }))
          .then((storageId) => patch(item.key, { storageId, status: "done" }))
          .catch((error: unknown) =>
            patch(item.key, {
              status: "error",
              error: error instanceof Error && error.message === "NOT_AN_IMAGE" ? "notAnImage" : "uploadFailed",
            }),
          )
      }
    },
    [items.length, upload, patch],
  )

  const remove = useCallback((key: string) => {
    setItems((list) => list.filter((item) => item.key !== key))
  }, [])

  const makeCover = useCallback((key: string) => {
    setItems((list) => {
      const item = list.find((i) => i.key === key)
      return item ? [item, ...list.filter((i) => i.key !== key)] : list
    })
  }, [])

  const busy = items.some((i) => i.status === "compressing" || i.status === "uploading")
  const readyIds = items.filter((i) => i.status === "done" && i.storageId).map((i) => i.storageId!)

  return { items, add, remove, makeCover, busy, readyIds }
}
