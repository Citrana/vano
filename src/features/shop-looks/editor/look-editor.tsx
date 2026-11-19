"use client"

import type { FunctionReturnType } from "convex/server"
import {
  CheckCircle2Icon,
  EyeIcon,
  ExternalLinkIcon,
  ImageIcon,
  InfoIcon,
  LayoutTemplateIcon,
  Loader2Icon,
  PaletteIcon,
  SquareIcon,
  type LucideIcon,
} from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"
import { useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { cn } from "cn"
import type { api } from "../../../../convex/_generated/api"
import { hasBlockingProblem } from "../../../../convex/lib/looks/contrast"
import { isFreeLook } from "../../../../convex/lib/looks/presets"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { DEMO_CURRENCY, DEMO_PRODUCTS } from "@/features/marketing/demo/demo-shop"
import { useErrorMessage } from "@/lib/use-error-message"
import { BannerSection } from "./banner-section"
import { ButtonsSection } from "./buttons-section"
import { ChoiceGroup } from "./choice-group"
import { ColorsSection } from "./colors-section"
import { LookPreview, type PreviewProduct } from "./look-preview"
import { LooksSection } from "./looks-section"
import { useLookEditor, type MineLook } from "./use-look-editor"

type Shop = NonNullable<FunctionReturnType<typeof api.shops.myShop>>
type Products = FunctionReturnType<typeof api.products.listMine>

/**
 * Editor sections, in order. Later phases (fonts, backgrounds, patterns,
 * card styles, section order) add an entry here and a panel below.
 */
const LOOK_SECTIONS = [
  { key: "looks", icon: LayoutTemplateIcon },
  { key: "colors", icon: PaletteIcon },
  { key: "buttons", icon: SquareIcon },
  { key: "banner", icon: ImageIcon },
] as const satisfies readonly { key: string; icon: LucideIcon }[]
type SectionKey = (typeof LOOK_SECTIONS)[number]["key"]

function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-sm",
        tone === "warn" ? "bg-tag-warning text-tag-warning-foreground" : "bg-card",
      )}
    >
      <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

/**
 * The seller's "Shop look" page (CLAUDE.md "Shop looks"). Phones: one
 * section at a time (chips on top), a sticky bar with Preview + Publish,
 * the preview in a bottom sheet. Desktop: all sections on the left, the
 * phone preview sticky on the right.
 */
export function LookEditor({ mine, shop, products }: { mine: MineLook; shop: Shop; products: Products }) {
  const t = useTranslations("LookEditor")
  const td = useTranslations("Demo")
  const format = useFormatter()
  const errorMessage = useErrorMessage()
  const editor = useLookEditor(mine)

  const [section, setSection] = useState<SectionKey>("looks")
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewMode, setPreviewMode] = useState<"draft" | "live">("draft")
  const [confirm, setConfirm] = useState<null | "publish" | "discard">(null)
  const [busy, setBusy] = useState<null | "publish" | "discard">(null)
  const [justPublished, setJustPublished] = useState(false)

  const suspended = shop.status === "suspended"
  const blocking = hasBlockingProblem(editor.problems)
  const hasWarnings = editor.problems.some((p) => p.level === "warn")
  const planLocked = !mine.entitled && !isFreeLook(editor.draft)
  const canPublish = editor.unpublished && !blocking && !planLocked && !suspended && busy === null
  const showLiveToggle = editor.unpublished || mine.hiddenByPlan

  // Preview data: the seller's visible products, or demo samples.
  const ownProducts: PreviewProduct[] = products.filter((p) => !p.hidden && !p.overLimit)
  const sample = ownProducts.length === 0
  const previewProducts: PreviewProduct[] = sample
    ? DEMO_PRODUCTS.map((p) => ({
        _id: p.id,
        name: td(`products.${p.id}.name`),
        price: p.price,
        category: p.category,
        soldOut: p.soldOut ?? false,
        coverUrl: p.photos[0].src,
      }))
    : ownProducts
  const tiles = useMemo(() => {
    const covers = products.map((p) => p.coverUrl).filter((url): url is string => url !== null)
    return covers.length >= 2 ? covers.slice(0, 2) : [DEMO_PRODUCTS[0].photos[0], DEMO_PRODUCTS[3].photos[0]]
  }, [products])
  const headerShop = {
    name: shop.name,
    slug: shop.slug,
    language: shop.language,
    logoUrl: shop.logoUrl,
    description: shop.description ?? null,
    city: shop.city,
    country: shop.country,
  }

  async function publish() {
    setConfirm(null)
    setBusy("publish")
    try {
      if (await editor.publish()) {
        setJustPublished(true)
        setPreviewMode("draft")
        toast.success(t("toast.published"))
      } else {
        toast.error(t("toast.saveFailed"))
      }
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  async function discard() {
    setConfirm(null)
    setBusy("discard")
    try {
      await editor.discard()
      toast.success(t("toast.discarded"))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const onPublish = () => (hasWarnings ? setConfirm("publish") : void publish())

  const status = (() => {
    switch (editor.saveState) {
      case "saving":
      case "dirty":
        return { icon: <Loader2Icon className="size-3.5 animate-spin" />, text: t("status.saving") }
      case "error":
        return { icon: null, text: t("status.error") }
      default:
        if (editor.unpublished) return { icon: null, text: t("status.draft") }
        return { icon: <CheckCircle2Icon className="size-3.5 text-success" />, text: mine.published ? t("status.live") : t("status.default") }
    }
  })()

  const previewLook = previewMode === "live" ? editor.liveResolved : editor.resolved
  const preview = (
    <div className="flex flex-col items-center gap-3">
      {showLiveToggle ? (
        <ChoiceGroup
          label={t("preview.show")}
          value={previewMode}
          onChange={setPreviewMode}
          className="w-full max-w-[300px]"
          options={[
            { value: "draft", label: t("preview.draft") },
            { value: "live", label: t("preview.live") },
          ]}
        />
      ) : null}
      <LookPreview
        look={previewLook}
        shop={headerShop}
        currency={sample ? DEMO_CURRENCY : shop.currency}
        products={previewProducts}
        sample={sample}
        label={t("preview.label")}
      />
    </div>
  )

  const publishButton = (className?: string) => (
    <Button type="button" onClick={onPublish} disabled={!canPublish} className={className}>
      {busy === "publish" ? <Loader2Icon className="animate-spin" /> : null}
      {t("actions.publish")}
    </Button>
  )

  const viewShop = (
    <a
      href={`/${shop.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonVariants({ variant: justPublished ? "outline" : "ghost", size: "sm" })}
    >
      {justPublished ? <CheckCircle2Icon className="text-success" /> : null}
      {t("actions.viewShop")}
      <ExternalLinkIcon />
    </a>
  )

  const publishHint = suspended
    ? null
    : planLocked
      ? t("hints.planLocked")
      : blocking
        ? t("hints.blocking")
        : null

  return (
    <div className="flex flex-col gap-5 pb-28 lg:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground" role="status" aria-live="polite">
            {status.icon}
            {status.text}
            {editor.saveState === "error" ? (
              <Button type="button" variant="link" size="sm" className="h-auto px-1" onClick={() => void editor.flush()}>
                {t("actions.retry")}
              </Button>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {viewShop}
          {editor.unpublished ? (
            <Button type="button" variant="ghost" size="sm" disabled={busy !== null || suspended} onClick={() => setConfirm("discard")}>
              {t("actions.discard")}
            </Button>
          ) : null}
        </div>
      </div>

      {mine.hiddenByPlan ? (
        <Notice tone="warn">
          <p>{t("notices.hiddenByPlan")}</p>
          <Link href="/dashboard/billing" className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}>
            {t("actions.upgrade")}
          </Link>
        </Notice>
      ) : !mine.entitled ? (
        <Notice>
          <p>{t("notices.free")}</p>
          <Link href="/dashboard/billing" className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}>
            {t("actions.upgrade")}
          </Link>
        </Notice>
      ) : null}
      {mine.resetByAdminAt !== null ? (
        <Notice tone="warn">
          <p>{t("notices.resetByAdmin", { date: format.dateTime(new Date(mine.resetByAdminAt), { dateStyle: "medium" }) })}</p>
          <Link href="/dashboard/notifications" className="w-fit font-medium underline underline-offset-4">
            {t("notices.seeNotifications")}
          </Link>
        </Notice>
      ) : null}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-10">
        <div className="flex flex-col gap-4">
          {/* Phones: one section at a time. */}
          <div role="group" aria-label={t("sections.label")} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:hidden">
            {LOOK_SECTIONS.map(({ key, icon: Icon }) => (
              <button
                key={key}
                type="button"
                aria-pressed={section === key}
                aria-controls={`look-section-${key}`}
                onClick={() => setSection(key)}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium whitespace-nowrap focus-ring",
                  section === key ? "chip-selected" : "bg-card hover:bg-muted",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {t(`sections.${key}`)}
              </button>
            ))}
          </div>

          {LOOK_SECTIONS.map(({ key }) => (
            <Card key={key} id={`look-section-${key}`} className={cn("gap-4", section !== key && "hidden lg:flex")}>
              <h2 className="font-heading text-lg font-bold tracking-tight">{t(`sections.${key}`)}</h2>
              {key === "looks" ? (
                <LooksSection editor={editor} entitled={mine.entitled} disabled={suspended} tiles={tiles} />
              ) : key === "colors" ? (
                <ColorsSection editor={editor} disabled={suspended} />
              ) : key === "buttons" ? (
                <ButtonsSection editor={editor} disabled={suspended} />
              ) : (
                <BannerSection editor={editor} disabled={suspended} />
              )}
            </Card>
          ))}
        </div>

        {/* Desktop: sticky preview with the main action. */}
        <aside className="sticky top-20 hidden flex-col gap-4 lg:flex">
          <div className="flex flex-col gap-2">
            {publishButton("w-full")}
            {publishHint ? <p className="text-xs text-muted-foreground">{publishHint}</p> : null}
          </div>
          {preview}
        </aside>
      </div>

      {/* Phones: sticky bar. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        {publishHint ? <p className="mb-2 text-xs text-muted-foreground">{publishHint}</p> : null}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
            <EyeIcon />
            {t("actions.preview")}
          </Button>
          {publishButton()}
        </div>
      </div>

      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent side="bottom" className="items-center overflow-y-auto lg:hidden">
          <SheetTitle className="self-start">{t("preview.title")}</SheetTitle>
          {preview}
        </SheetContent>
      </Sheet>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogTitle>{confirm === "discard" ? t("confirm.discardTitle") : t("confirm.publishTitle")}</DialogTitle>
          <DialogDescription>{confirm === "discard" ? t("confirm.discardBody") : t("confirm.publishBody")}</DialogDescription>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("confirm.cancel")}</DialogClose>
            {confirm === "discard" ? (
              <Button variant="destructive" onClick={() => void discard()}>
                {t("actions.discard")}
              </Button>
            ) : (
              <Button onClick={() => void publish()}>{t("confirm.publishAnyway")}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
