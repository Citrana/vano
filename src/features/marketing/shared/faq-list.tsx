import { ChevronDownIcon } from "lucide-react"

export type FaqEntry = { id: string; question: string; answer: string }

/**
 * Expandable questions using native <details>: no JS, keyboard and
 * screen-reader friendly. No hooks, so client components can use it too.
 * A clean list separated by thin lines; items sharing `name` form an
 * exclusive accordion (opening one closes the others).
 */
export function FaqList({ items, name }: { items: FaqEntry[]; name?: string }) {
  return (
    <ul className="divide-y border-y">
      {items.map((item) => (
        <li key={item.id}>
          <details name={name} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-semibold focus-ring md:text-lg [&::-webkit-details-marker]:hidden">
              {item.question}
              <ChevronDownIcon className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
            </summary>
            <p className="pb-5 text-base text-muted-foreground">{item.answer}</p>
          </details>
        </li>
      ))}
    </ul>
  )
}
