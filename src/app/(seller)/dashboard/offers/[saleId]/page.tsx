"use client"

import { useParams } from "next/navigation"
import { SaleEditorPage } from "@/features/sales/sale-editor-page"

export default function EditSalePage() {
  const { saleId } = useParams<{ saleId: string }>()
  return <SaleEditorPage saleId={saleId} />
}
