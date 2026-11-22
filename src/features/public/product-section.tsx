import { ChevronDownIcon } from "lucide-react"
import type { ReactNode } from "react"

/**
 * A collapsible section of the product page (Description, Shop info):
 * native `<details>` (works without JavaScript, keyboard and screen
 * readers included), an uppercase title with a chevron, thin dividers.
 * Works in server and client components.
 */
export function ProductSection({ title, open = false, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group border-b first:border-t">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-semibold tracking-wide uppercase focus-ring [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDownIcon className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
      </summary>
      <div className="flex flex-col gap-4 pb-5 text-sm">{children}</div>
    </details>
  )
}
