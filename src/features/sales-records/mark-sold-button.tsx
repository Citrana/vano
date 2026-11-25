"use client"

import { LockIcon, ReceiptTextIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useState } from "react"
import type { Id } from "../../../convex/_generated/dataModel"
import { Button, buttonVariants } from "@/components/ui/button"
import { RecordSaleDialog } from "./record-sale-dialog"
import { useSalesAccess } from "./use-sales-access"

/**
 * "Mark as sold" on the product page. Without the plan it links to the
 * Sales page (which explains the plan); without the permission it hides.
 */
export function MarkSoldButton({ productId }: { productId: Id<"products"> }) {
  const t = useTranslations("SalesRecords")
  const access = useSalesAccess()
  const [open, setOpen] = useState(false)
  if (!access.ready || !access.allowed) return null
  if (access.locked) {
    return (
      <Link href="/dashboard/sales" className={buttonVariants({ variant: "outline" })} aria-label={t("lock.menuItem", { plan: access.plan })}>
        <LockIcon /> {t("markAsSold")}
      </Link>
    )
  }
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ReceiptTextIcon /> {t("markAsSold")}
      </Button>
      <RecordSaleDialog productId={productId} open={open} onOpenChange={setOpen} />
    </>
  )
}
