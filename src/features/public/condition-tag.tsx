import { cn } from "cn"

/**
 * The product's condition ("Brand new" / "Thrift") as a small tag beside
 * the category on the product page. Square corners like the size chips
 * (CLAUDE.md "Public pages"); the label is translated by the page, in the
 * shop's language.
 */
export function ConditionTag({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-[2px] border border-[var(--chip,var(--foreground))] px-1.5 py-px text-[11px] font-semibold tracking-normal normal-case text-foreground",
        className,
      )}
    >
      {label}
    </span>
  )
}
