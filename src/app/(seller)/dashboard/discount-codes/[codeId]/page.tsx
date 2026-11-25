"use client"

import { useParams } from "next/navigation"
import { CodeEditorPage } from "@/features/discount-codes/code-editor-page"

export default function EditDiscountCodePage() {
  const { codeId } = useParams<{ codeId: string }>()
  return <CodeEditorPage codeId={codeId} />
}
