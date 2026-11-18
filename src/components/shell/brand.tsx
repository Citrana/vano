import Link from "next/link"
import { cn } from "cn"

/** Wordmark link. Focus ring only for keyboard users (focus-visible). */
export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("rounded-md font-heading text-2xl font-extrabold tracking-tight text-foreground focus-ring", className)}>
      vano<span className="text-coral">.</span>
    </Link>
  )
}
