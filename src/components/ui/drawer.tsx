"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"
import { cn } from "cn"

/**
 * A bottom sheet that can be dragged between heights (base-ui Drawer, same
 * family as `dialog.tsx` / `sheet.tsx`). Non-modal by default: no
 * backdrop, the page behind stays visible and usable (e.g. a live preview
 * above the sheet). Snap points: numbers 0–1 are fractions of the viewport
 * height. Reduced motion: snapping is instant.
 */
function Drawer({ modal = false, disablePointerDismissal = true, ...props }: DrawerPrimitive.Root.Props) {
  return <DrawerPrimitive.Root data-slot="drawer" modal={modal} disablePointerDismissal={disablePointerDismissal} {...props} />
}

function DrawerContent({
  className,
  children,
  container,
  ...props
}: DrawerPrimitive.Popup.Props &
  /** Where the sheet is mounted (e.g. inside a shop look scope, so it uses the shop's colours). */
  Pick<DrawerPrimitive.Portal.Props, "container">) {
  return (
    <DrawerPrimitive.Portal container={container}>
      {/* The viewport lets clicks through: only the sheet itself catches them. */}
      <DrawerPrimitive.Viewport className="pointer-events-none fixed inset-0 z-40 flex items-end justify-center">
        <DrawerPrimitive.Popup
          data-slot="drawer-content"
          className={cn(
            "pointer-events-auto relative flex max-h-[92dvh] min-h-0 w-full touch-none flex-col rounded-t-xl border-t bg-background text-sm shadow-float outline-none",
            "[padding-bottom:max(0px,calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))] [transform:translateY(calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))]",
            "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:duration-0",
            "data-starting-style:[transform:translateY(calc(100%+2px))] data-ending-style:[transform:translateY(calc(100%+2px))] data-starting-style:[padding-bottom:0] data-ending-style:[padding-bottom:0]",
            "motion-reduce:transition-none",
            className,
          )}
          {...props}
        >
          {children}
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPrimitive.Portal>
  )
}

/** The grab bar. Decorative: the sheet also has buttons to resize and close. */
function DrawerHandle({ className }: { className?: string }) {
  return <div aria-hidden className={cn("mx-auto h-1.5 w-12 shrink-0 rounded-full bg-border", className)} />
}

/** The scrolling body (drags start from the header, not from here). */
function DrawerBody({ className, ...props }: DrawerPrimitive.Content.Props) {
  return (
    <DrawerPrimitive.Content
      className={cn("min-h-0 flex-1 touch-auto overflow-y-auto overscroll-contain px-4 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]", className)}
      {...props}
    />
  )
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return <DrawerPrimitive.Title className={cn("font-heading text-lg font-bold tracking-tight", className)} {...props} />
}

function DrawerDescription({ className, ...props }: DrawerPrimitive.Description.Props) {
  return <DrawerPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />
}

const DrawerClose = DrawerPrimitive.Close

export { Drawer, DrawerBody, DrawerClose, DrawerContent, DrawerDescription, DrawerHandle, DrawerTitle }
export type DrawerSnapPoint = DrawerPrimitive.Root.SnapPoint
