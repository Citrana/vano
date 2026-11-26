"use client"

import { useTranslations } from "next-intl"
import { useRef, type ClipboardEvent, type KeyboardEvent } from "react"
import { cn } from "cn"
import { fieldClasses } from "@/components/ui/input"
import { AUTH_CODE_LENGTH } from "../../../convex/lib/authCodes"
import { enterDigits, eraseDigit, fromBoxes, isFilled, toBoxes, typedDigits } from "./code-input-logic"

/**
 * Six boxes for an emailed code: the number keyboard on phones, the code
 * suggested by iOS / Android from the email (`one-time-code`), auto-advance,
 * Backspace goes back, and a pasted code fills every box. Calls
 * `onComplete` once the last digit is in. Rules in `code-input-logic.ts`.
 */
export function CodeInput({
  id,
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus,
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  onComplete?: (code: string) => void
  disabled?: boolean
  autoFocus?: boolean
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}) {
  const t = useTranslations("Auth")
  const length = AUTH_CODE_LENGTH
  const boxes = toBoxes(value, length)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  function focusBox(index: number) {
    const box = refs.current[index]
    box?.focus()
    box?.select()
  }

  function apply(next: { boxes: string[]; focus: number }) {
    const code = fromBoxes(next.boxes)
    onChange(code)
    focusBox(next.focus)
    if (isFilled(code, length) && code !== value) onComplete?.(code)
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault()
      apply(eraseDigit(boxes, index))
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault()
      focusBox(index - 1)
    } else if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault()
      focusBox(index + 1)
    }
  }

  function onPaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    apply(enterDigits(boxes, index, typedDigits(" ", event.clipboardData.getData("text"))))
  }

  return (
    <div role="group" aria-label={t("codeLabel")} className="grid grid-cols-6 gap-2">
      {boxes.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          id={i === 0 ? id : `${id}-${i}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && i === 0}
          aria-label={t("codeDigit", { n: i + 1, total: length })}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          disabled={disabled}
          value={digit.trim()}
          onFocus={(e) => e.target.select()}
          onChange={(e) => apply(enterDigits(boxes, i, typedDigits(digit, e.target.value)))}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => onPaste(i, e)}
          className={cn(fieldClasses, "h-12 px-0 text-center font-heading text-xl font-bold tabular-nums md:h-12 md:text-xl")}
        />
      ))}
    </div>
  )
}
