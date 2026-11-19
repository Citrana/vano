"use client"

import { MessageCircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ButtonsFacet } from "../../../../convex/lib/looks/validators"
import { buttonVariants } from "@/components/ui/button"
import { ShopLookScope } from "../look-scope"
import { ChoiceGroup } from "./choice-group"
import type { LookEditorState } from "./use-look-editor"

/** Shape, fill and weight of the shop's buttons and chips, with a live sample. */
export function ButtonsSection({ editor, disabled }: { editor: LookEditorState; disabled: boolean }) {
  const t = useTranslations("LookEditor.buttons")
  const tp = useTranslations("Public")
  const buttons = editor.resolved.buttons
  const set = (patch: Partial<ButtonsFacet>) => editor.setOverride("buttons", { ...buttons, ...patch })

  return (
    <div className="flex flex-col gap-5">
      <ChoiceGroup
        label={t("shape")}
        value={buttons.shape}
        disabled={disabled}
        onChange={(shape) => set({ shape })}
        options={[
          { value: "rounded", label: t("rounded") },
          { value: "pill", label: t("pill") },
          { value: "square", label: t("square") },
        ]}
      />
      <ChoiceGroup
        label={t("fill")}
        value={buttons.fill}
        disabled={disabled}
        onChange={(fill) => set({ fill })}
        options={[
          { value: "solid", label: t("solid") },
          { value: "outline", label: t("outline") },
        ]}
      />
      <ChoiceGroup
        label={t("weight")}
        value={buttons.weight}
        disabled={disabled}
        onChange={(weight) => set({ weight })}
        options={[
          { value: "soft", label: t("soft") },
          { value: "bold", label: t("bold") },
        ]}
      />
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("sample")}</span>
        <ShopLookScope look={editor.resolved} className="flex flex-col gap-3 rounded-xl border p-4">
          <div aria-hidden className="flex flex-wrap gap-2">
            <span className="shop-chip chip-selected inline-flex min-h-10 items-center rounded-full border px-4 text-sm">{tp("all")}</span>
            <span className="shop-chip inline-flex min-h-10 items-center rounded-full border bg-card px-4 text-sm">M</span>
            <span className="shop-chip inline-flex min-h-10 items-center rounded-full border bg-card px-4 text-sm">L</span>
            <span className="shop-btn inline-flex items-center rounded-full bg-(--chip) px-2.5 py-1 text-xs font-semibold text-(--chip-foreground)">
              {tp("soldOut")}
            </span>
          </div>
          <span aria-hidden className={buttonVariants({ size: "lg", variant: "whatsapp", className: "shop-btn w-full" })}>
            <MessageCircleIcon />
            {tp("order")}
          </span>
          <p className="text-xs text-muted-foreground">{t("whatsappNote")}</p>
        </ShopLookScope>
      </div>
    </div>
  )
}
