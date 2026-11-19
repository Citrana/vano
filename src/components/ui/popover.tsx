"use client"

import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { cn } from "cn"

/**
 * A small floating panel (base-ui Popover): focus moves in, Escape and
 * outside-click close, focus returns to the trigger. Used for filters.
 */
function Popover(props: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger(props: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  align = "end",
  sideOffset = 6,
  ...props
}: PopoverPrimitive.Popup.Props & Pick<PopoverPrimitive.Positioner.Props, "align" | "sideOffset">) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner className="z-50 outline-none" align={align} sideOffset={sideOffset} collisionPadding={16}>
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "flex max-h-(--available-height) w-80 max-w-[calc(100vw-32px)] origin-(--transform-origin) flex-col gap-4 overflow-y-auto rounded-xl border bg-popover p-4 text-sm text-popover-foreground shadow-float outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return <PopoverPrimitive.Title className={cn("font-heading text-base font-bold", className)} {...props} />
}

export { Popover, PopoverContent, PopoverTitle, PopoverTrigger }
