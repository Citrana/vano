import Link from "next/link"
import { cn } from "cn"

export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("font-heading text-2xl font-extrabold tracking-tight text-foreground", className)}>
      vano<span className="text-coral">.</span>
    </Link>
  )
}
