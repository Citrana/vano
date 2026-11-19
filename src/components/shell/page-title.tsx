import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { buttonVariants } from "@/components/ui/button"

/** Page heading with an optional back link and an optional action on the right. */
export function PageTitle({
  title,
  backHref,
  backLabel,
  action,
}: {
  title: string
  backHref?: string
  backLabel?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex items-center gap-2">
      {backHref ? (
        <Link href={backHref} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={backLabel}>
          <ArrowLeftIcon />
        </Link>
      ) : null}
      <h1 className="min-w-0 flex-1 font-heading text-2xl font-bold tracking-tight">{title}</h1>
      {action}
    </div>
  )
}
