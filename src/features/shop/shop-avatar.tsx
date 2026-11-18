import { cn } from "cn"

/** The shop logo, or the first letter of the shop name when there is none. */
export function ShopAvatar({ name, logoUrl, className }: { name: string; logoUrl: string | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-secondary font-heading text-lg font-bold text-secondary-foreground",
        className,
      )}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
        <img src={logoUrl} alt="" className="size-full object-cover" />
      ) : (
        name.trim().charAt(0).toUpperCase()
      )}
    </span>
  )
}
