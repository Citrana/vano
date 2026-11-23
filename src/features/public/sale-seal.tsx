import { cn } from "cn"

/**
 * A scalloped circle in a 100×100 box: `lobes` round bumps on a circle of
 * radius `r`, each an outward arc whose radius is `roundness` × its chord.
 * Pure (built once at module load).
 */
export function sealPath(lobes: number, r: number, roundness = 0.6): string {
  const point = (i: number) => {
    const angle = (i / lobes) * 2 * Math.PI - Math.PI / 2
    return [50 + r * Math.cos(angle), 50 + r * Math.sin(angle)].map((n) => n.toFixed(2)).join(" ")
  }
  const chord = 2 * r * Math.sin(Math.PI / lobes)
  const arc = (chord * roundness).toFixed(2)
  let d = `M${point(0)}`
  for (let i = 1; i <= lobes; i++) d += `A${arc} ${arc} 0 0 1 ${point(i)}`
  return `${d}Z`
}

const SEAL_PATH = sealPath(14, 44)

/**
 * The sale sticker on a product card (CLAUDE.md "Shop looks"): a
 * scalloped seal over the card's top-right corner, in the look's badge
 * colours (`--chip` / `--chip-foreground`, covered by the contrast
 * check). Static (no animation). The shape is decorative; the label is
 * real text.
 */
export function SaleSeal({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute z-20 flex size-[46px] -rotate-6 items-center justify-center md:size-14",
        className,
      )}
    >
      <svg viewBox="0 0 100 100" aria-hidden className="absolute inset-0 size-full fill-[var(--chip,var(--foreground))]">
        <path d={SEAL_PATH} />
      </svg>
      <span className="relative px-1 text-center text-[11px] leading-none font-bold text-[var(--chip-foreground,var(--background))] tabular-nums md:text-[13px]">
        {label}
      </span>
    </span>
  )
}
