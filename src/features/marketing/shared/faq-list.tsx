import { ChevronDownIcon } from "lucide-react"

export type FaqEntry = { id: string; question: string; answer: string }

/**
 * Expandable questions using native <details>: no JS, keyboard and
 * screen-reader friendly. No hooks, so client components can use it too.
 */
export function FaqList({ items }: { items: FaqEntry[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id}>
          <details className="group rounded-2xl bg-card shadow-soft ring-1 ring-foreground/5 open:ring-foreground/10">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 text-base font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:text-lg [&::-webkit-details-marker]:hidden">
              {item.question}
              <ChevronDownIcon className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="px-5 pb-5 text-base text-muted-foreground">{item.answer}</p>
          </details>
        </li>
      ))}
    </ul>
  )
}
