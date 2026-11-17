"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"
import { cleanTags, LIMITS } from "../../../convex/lib/catalog"

/**
 * Free tags (sizes, colors). Enter or comma adds; Backspace on empty input
 * removes the last one; pasting "S, M, L" adds three. Uses `cleanTags`, so
 * the server sees the same list.
 */
function TagInput({
  id,
  value,
  onChange,
  placeholder,
  ...aria
}: {
  id: string
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}) {
  const t = useTranslations("TagInput")
  const [draft, setDraft] = React.useState("")

  function commit(text: string) {
    const parts = text.split(",")
    const next = cleanTags([...value, ...parts.map((p) => p.slice(0, LIMITS.tagMax))]).slice(0, LIMITS.maxTags)
    onChange(next)
    setDraft("")
  }

  return (
    <div
      className={cn(
        "flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-card px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 md:min-h-9",
        aria["aria-invalid"] && "border-destructive"
      )}
    >
      {value.map((tag) => (
        <span key={tag} className="inline-flex h-8 items-center gap-1 rounded-md bg-secondary pr-1 pl-2.5 text-sm md:h-7">
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((v) => v !== tag))}
            className="inline-flex size-6 items-center justify-center rounded hover:bg-foreground/10"
            aria-label={t("remove", { tag })}
          >
            <XIcon className="size-3.5" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        placeholder={value.length === 0 ? placeholder : undefined}
        enterKeyHint="done"
        onChange={(e) => {
          const text = e.target.value
          if (text.includes(",")) commit(text)
          else setDraft(text)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            if (draft.trim()) commit(draft)
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={() => draft.trim() && commit(draft)}
        className="h-8 min-w-24 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground md:text-sm"
        {...aria}
      />
    </div>
  )
}

export { TagInput }
