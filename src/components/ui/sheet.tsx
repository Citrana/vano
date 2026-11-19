"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { useTranslations } from "next-intl"
import { cn } from "cn"
import { XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * A panel that slides in from the left (mobile menus) or the right (admin
 * details drawer). Built on the same base-ui Dialog as `dialog.tsx`: focus
 * trap, Escape and backdrop close, focus returns to the opener.
 */
function Sheet(props: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger(props: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

const SIDES = {
  left: "inset-y-0 left-0 w-72 max-w-[85vw] border-r data-open:slide-in-from-left data-closed:slide-out-to-left",
  right: "inset-y-0 right-0 w-full border-l data-open:slide-in-from-right data-closed:slide-out-to-right",
} as const

function SheetContent({
  className,
  children,
  side = "left",
  ...props
}: SheetPrimitive.Popup.Props & { side?: keyof typeof SIDES }) {
  const t = useTranslations("Common")
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-background p-4 text-sm shadow-float duration-200 outline-none data-open:animate-in data-closed:animate-out motion-reduce:animate-none",
          SIDES[side],
          className
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close render={<Button variant="ghost" size="icon" className="absolute top-2 right-2 z-10" />}>
          <XIcon />
          <span className="sr-only">{t("close")}</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Popup>
    </SheetPrimitive.Portal>
  )
}

function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return <SheetPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return <SheetPrimitive.Title className={cn("pr-12 font-heading text-lg font-bold tracking-tight", className)} {...props} />
}

export { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger }
