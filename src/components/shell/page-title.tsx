import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

export function PageTitle({ title, backHref, backLabel }: { title: string; backHref?: string; backLabel?: string }) {
  return (
    <div className="mb-5 flex items-center gap-2">
      {backHref ? (
        <Link href={backHref} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={backLabel}>
          <ArrowLeftIcon />
        </Link>
      ) : null}
      <h1 className="font-heading text-2xl font-bold tracking-tight">{title}</h1>
    </div>
  )
}
