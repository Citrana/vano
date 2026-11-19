import type { CSSProperties, ReactNode } from "react"
import { cn } from "cn"
import { lookCssVars, type ResolvedLook } from "../../../convex/lib/looks/resolve"

type ScopeLook = Pick<ResolvedLook<unknown>, "colors" | "buttons" | "radius" | "dark">

/**
 * Applies a shop look (CLAUDE.md "Shop looks"): sets the semantic tokens
 * as inline CSS variables, so every shop component inside follows, and
 * the button style as data attributes (rules in globals.css). Works in
 * server and client components; rendered with the first HTML, so there's
 * no flash or layout shift.
 */
export function ShopLookScope({
  look,
  className,
  style,
  children,
}: {
  look: ScopeLook
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <div
      data-shop-look=""
      data-btn-fill={look.buttons.fill}
      data-btn-weight={look.buttons.weight}
      data-look-dark={look.dark ? "" : undefined}
      style={{ ...(lookCssVars(look) as CSSProperties), ...style }}
      className={cn(look.dark && "[color-scheme:dark]", className)}
    >
      {children}
    </div>
  )
}
