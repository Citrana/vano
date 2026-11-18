"use client"

import { CheckIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"
import { CATEGORY_KEYS, type Category } from "../../../convex/lib/catalog"

/** Multi-select category chips (checkbox semantics). */
export function CategoryPicker({
  value,
  onChange,
  invalid,
  describedBy,
}: {
  value: Category[]
  onChange: (next: Category[]) => void
  invalid?: boolean
  describedBy?: string
}) {
  const tc = useTranslations("Categories")
  const toggle = (key: Category) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key])

  return (
    <div className="flex flex-wrap gap-2" aria-describedby={describedBy} aria-invalid={invalid}>
      {CATEGORY_KEYS.map((key) => {
        const checked = value.includes(key)
        return (
          <button
            key={key}
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={() => toggle(key)}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors focus-ring md:min-h-9",
              checked ? "chip-selected" : "bg-card hover:bg-muted",
              invalid && !checked && "border-destructive/50"
            )}
          >
            {checked ? <CheckIcon className="size-4" aria-hidden /> : null}
            {tc(key)}
          </button>
        )
      })}
    </div>
  )
}
