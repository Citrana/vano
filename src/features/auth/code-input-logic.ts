/**
 * Pure rules of the 6-box code input (`code-input.tsx`). The value is a
 * string with one character per box; a space marks an empty box, so a
 * box in the middle can be cleared without shifting the others.
 */

export const EMPTY_BOX = " "

export function toBoxes(value: string, length: number): string[] {
  return Array.from({ length }, (_, i) => (/\d/.test(value[i] ?? "") ? value[i] : EMPTY_BOX))
}

export function fromBoxes(boxes: string[]): string {
  return boxes.join("").trimEnd()
}

export function isFilled(value: string, length: number): boolean {
  return new RegExp(`^\\d{${length}}$`).test(value)
}

/**
 * What the person typed in a box: the new digits only. The box's text is
 * selected on focus, but if a browser appends instead, the old digit is
 * dropped.
 */
export function typedDigits(previous: string, raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.length === 2 && previous !== EMPTY_BOX && digits.startsWith(previous)) return digits.slice(1)
  return digits
}

/**
 * Puts digits into the boxes from `index` (one typed digit, a pasted or
 * autofilled code). A full-length code always fills from the first box.
 * Returns the boxes and the box to focus next.
 */
export function enterDigits(boxes: string[], index: number, digits: string): { boxes: string[]; focus: number } {
  const length = boxes.length
  if (digits === "") return { boxes, focus: index }
  const start = digits.length >= length ? 0 : index
  const next = [...boxes]
  const usable = digits.slice(0, length - start)
  for (let i = 0; i < usable.length; i++) next[start + i] = usable[i]
  return { boxes: next, focus: Math.min(start + usable.length, length - 1) }
}

/** Backspace: clears this box, or the previous one if this one is empty. */
export function eraseDigit(boxes: string[], index: number): { boxes: string[]; focus: number } {
  const next = [...boxes]
  if (next[index] !== EMPTY_BOX) {
    next[index] = EMPTY_BOX
    return { boxes: next, focus: index }
  }
  const previous = Math.max(index - 1, 0)
  next[previous] = EMPTY_BOX
  return { boxes: next, focus: previous }
}

/** "0:42", "14:05": the time left before a new code can be sent. */
export function formatWait(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}
