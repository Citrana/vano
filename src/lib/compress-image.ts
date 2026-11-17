/**
 * Browser-side image compression (CLAUDE.md "Images"): longest side
 * ≤ 1200px, JPEG, quality stepped down until the file is ≤ ~300 KB. JPEG
 * (not WebP) so WhatsApp / Facebook link previews work everywhere;
 * transparent areas become white.
 */

export const MAX_DIMENSION = 1200
export const TARGET_BYTES = 300_000
const QUALITIES = [0.85, 0.78, 0.7, 0.62, 0.55, 0.48]
const MIN_DIMENSION = 480

/** Scales (w, h) down to fit within `max` on its longest side; never up. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= max) return { width, height }
  const scale = max / longest
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      quality,
    )
  })
}

export async function compressImage(
  file: Blob,
  { maxDimension = MAX_DIMENSION, targetBytes = TARGET_BYTES } = {},
): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  try {
    let { width, height } = fitWithin(bitmap.width, bitmap.height, maxDimension)
    let best: Blob | null = null
    // Lower quality first; if even the lowest is too big, shrink and retry.
    for (;;) {
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas unsupported")
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(bitmap, 0, 0, width, height)
      for (const quality of QUALITIES) {
        const blob = await canvasToBlob(canvas, quality)
        if (!best || blob.size < best.size) best = blob
        if (blob.size <= targetBytes) return blob
      }
      if (best && Math.max(width, height) <= MIN_DIMENSION) return best
      ;({ width, height } = fitWithin(width, height, Math.round(Math.max(width, height) * 0.8)))
    }
  } finally {
    bitmap.close()
  }
}
