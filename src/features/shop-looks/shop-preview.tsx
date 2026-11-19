import type { ReactNode } from "react"
import { cn } from "cn"
import type { ResolvedLook } from "../../../convex/lib/looks/resolve"
import { ShopLookScope } from "./look-scope"
import { ShopBanner } from "./shop-banner"

/**
 * A shop page drawn at phone width (375px) in a look: banner, then the
 * header and grid passed as children. Inert: it's a picture of the shop.
 * Used inside `PhoneFrame` by the Home hero and the "Shop look" editor.
 * `zoomClassName` scales the 375px page to the frame.
 */
export function ShopPreview({
  look,
  zoomClassName,
  children,
}: {
  look: ResolvedLook<string>
  zoomClassName: string
  children: ReactNode
}) {
  const hasBanner = look.banner.kind !== "none"
  return (
    <ShopLookScope look={look} className="size-full overflow-hidden">
      <div inert aria-hidden className={cn("w-[375px]", zoomClassName)}>
        {hasBanner ? <ShopBanner banner={look.banner} sizing="phone" priority={false} /> : null}
        <div className={cn("flex flex-col gap-5 px-4 pb-6", hasBanner ? "pt-0" : "pt-12")}>{children}</div>
      </div>
    </ShopLookScope>
  )
}
