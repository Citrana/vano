"use client"

import { useMutation } from "convex/react"
import { useCallback } from "react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { compressImage } from "./compress-image"

/**
 * Compress → get an upload URL → POST the file → storage id. The server
 * checks and claims the file when the shop / product is saved.
 */
export function useImageUpload() {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  return useCallback(
    async (file: File, onStage?: (stage: "compressing" | "uploading") => void): Promise<Id<"_storage">> => {
      if (!file.type.startsWith("image/")) throw new Error("NOT_AN_IMAGE")
      onStage?.("compressing")
      const blob = await compressImage(file)
      onStage?.("uploading")
      const url = await generateUploadUrl()
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": blob.type },
        body: blob,
      })
      if (!response.ok) throw new Error(`Upload failed: ${response.status}`)
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> }
      return storageId
    },
    [generateUploadUrl],
  )
}
