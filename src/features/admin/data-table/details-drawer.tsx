"use client"

import { useState, type ReactNode } from "react"
import { cn } from "cn"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

/**
 * The details panel of an admin list: slides in from the right so the
 * admin stays on the list. Opened by the `open` URL key; closing (Escape,
 * backdrop, ×) clears it and focus goes back to the row. The last record
 * stays rendered while the panel slides out.
 */
export function DetailsDrawer({
  openId,
  onClose,
  title,
  wide = false,
  children,
}: {
  openId: string | null
  onClose: () => void
  title: string
  wide?: boolean
  children: (id: string) => ReactNode
}) {
  const [shownId, setShownId] = useState(openId)
  if (openId !== null && openId !== shownId) setShownId(openId)

  return (
    <Sheet open={openId !== null} onOpenChange={(next) => (next ? null : onClose())}>
      <SheetContent side="right" className={cn("gap-0 p-0", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}>
        <div className="flex min-h-14 shrink-0 items-center border-b px-4">
          <SheetTitle className="truncate text-base">{title}</SheetTitle>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">{shownId ? children(shownId) : null}</div>
      </SheetContent>
    </Sheet>
  )
}
