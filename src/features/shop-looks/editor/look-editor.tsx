"use client"

import { Tabs } from "@base-ui/react/tabs"
import type { FunctionReturnType } from "convex/server"
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExternalLinkIcon,
  InfoIcon,
  Loader2Icon,
  Maximize2Icon,
  Undo2Icon,
  XIcon,
} from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { cn } from "cn"
import type { api } from "../../../../convex/_generated/api"
import { withoutPromo } from "../../../../convex/lib/looks/clean"
import { hasBlockingProblem } from "../../../../convex/lib/looks/contrast"
import { FREE_LOOK, isFreeLook } from "../../../../convex/lib/looks/presets"
import { isFreeSections } from "../../../../convex/lib/looks/sections"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerBody, DrawerClose, DrawerContent, DrawerHandle, DrawerTitle } from "@/components/ui/drawer"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { DEMO_CURRENCY, DEMO_PRODUCTS } from "@/features/marketing/demo/demo-shop"
import { useErrorMessage } from "@/lib/use-error-message"
import { ChoiceGroup } from "./choice-group"
import { LookPreview, type PreviewProduct } from "./look-preview"
import { SectionPanel } from "./section-panel"
import { PREVIEW_SECTIONS_MAX, previewProducts } from "./section-state"
import { SectionTabs, type SectionFlags } from "./section-tabs"
import { LOOK_SECTIONS, SECTION_KEYS, type SectionKey, type SectionProps } from "./sections"
import { useIsDesktop } from "@/lib/use-is-desktop"
import { filterAccess } from "../../../../convex/lib/looks/filters"
import { useLeaveGuard } from "./use-leave-guard"
import { useLookEditor, type MineLook } from "./use-look-editor"
import { useLookSection } from "./use-look-section"
import { WidePreview } from "./wide-preview"
import { useUpgradePlanName } from "@/features/billing/use-plan-catalog"

type Shop = NonNullable<FunctionReturnType<typeof api.shops.myShop>>
type Products = FunctionReturnType<typeof api.products.listMine>

/** Phone sheet heights: short = the space below the tabs; tall = up to the Publish row. */
const SHEET_MIN_PX = 220

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
 * The seller's "Shop look" page (CLAUDE.md "Shop looks"): one section at a
 * time (registry in `sections.tsx`, `?section=` in the address) and a live
 * preview. Desktop: sections on the left, options in the middle, the
 * preview and actions sticky on the right. Phones: actions, a compact
 * preview and the section tabs sticky on top; a section's options open in
 * a bottom sheet that can be dragged up or down.
 *
 * Only layout lives here: drafts, autosave and publishing are
 * `useLookEditor`'s, unchanged.
 */
export function LookEditor({ mine, shop, products }: { mine: MineLook; shop: Shop; products: Products }) {
  const t = useTranslations("LookEditor")
  const promoPlan = useUpgradePlanName("salesPromotions")
  const td = useTranslations("Demo")
  const format = useFormatter()
  const errorMessage = useErrorMessage()
  const editor = useLookEditor(mine)
  const isDesktop = useIsDesktop()
  const { section, select, inUrl } = useLookSection(SECTION_KEYS)
  const current = LOOK_SECTIONS.find((s) => s.key === section) ?? LOOK_SECTIONS[0]

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewMode, setPreviewMode] = useState<"draft" | "live">("draft")
  const [previewBanner, setPreviewBanner] = useState<"event" | "normal">(
    ("previewBanner" in current ? current.previewBanner : undefined) ?? "event",
  )
  const [previewWidth, setPreviewWidth] = useState<"phone" | "wide">("phone")
  const [confirm, setConfirm] = useState<null | "publish" | "discard">(null)
  const [busy, setBusy] = useState<null | "publish" | "discard">(null)
  const [justPublished, setJustPublished] = useState(false)

  // Phones: the section sheet. Opens when a section is picked (tap, link, Back).
  const [sheetOpen, setSheetOpen] = useState(inUrl)
  const [sheetTall, setSheetTall] = useState(false)
  const [seenSection, setSeenSection] = useState<SectionKey>(section)
  if (seenSection !== section) {
    setSeenSection(section)
    setSheetOpen(true)
    if ("previewBanner" in current) setPreviewBanner(current.previewBanner)
  }

  // Sheet heights from the sticky block: short = under the tabs, tall = under
  // the Publish row (so Publish and Discard stay reachable either way).
  const stickyTop = useRef<HTMLDivElement>(null)
  const actionsRow = useRef<HTMLDivElement>(null)
  const [sheetPx, setSheetPx] = useState({ short: 320, tall: 560 })
  useEffect(() => {
    const node = stickyTop.current
    if (!node || isDesktop) return
    const measure = () => {
      const free = (el: Element | null) => Math.round(window.innerHeight - (el?.getBoundingClientRect().bottom ?? 0) - 8)
      const short = Math.max(SHEET_MIN_PX, free(node))
      setSheetPx({ short, tall: Math.max(short + 1, free(actionsRow.current)) })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    window.addEventListener("resize", measure)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [isDesktop])

  const suspended = shop.status === "suspended"
  const blocking = hasBlockingProblem(editor.problems)
  const hasWarnings = editor.problems.some((p) => p.level === "warn")
  const promoLocked = !mine.promoEntitled && editor.draft.overrides.promo !== undefined
  const sectionsLocked = !mine.sectionsEntitled && !isFreeSections(editor.draft.overrides.sections)
  const planLocked = (!mine.entitled && !isFreeLook(withoutPromo(editor.draft))) || promoLocked || sectionsLocked
  const canPublish = editor.unpublished && !blocking && !planLocked && !suspended && busy === null
  // "Live now" differs from the draft: unpublished edits, a hidden design, or a saved promo that isn't on.
  const showLiveToggle =
    editor.unpublished ||
    mine.hiddenByPlan ||
    mine.sectionsHiddenByPlan ||
    (mine.published?.overrides.promo !== undefined && !(mine.promoLive && mine.promoEntitled))
  const unsaved = editor.saveState === "dirty" || editor.saveState === "saving" || editor.saveState === "error"
  useLeaveGuard(unsaved, t("leave"))

  const live = mine.published ?? FREE_LOOK
  const flags = Object.fromEntries(
    LOOK_SECTIONS.map((s) => [s.key, { changed: s.changed(editor.draft, live), locked: s.locked(mine) }]),
  ) as SectionFlags

  // Preview data: the seller's own products first, samples to fill (enough for the sections to show).
  const samples: PreviewProduct[] = useMemo(
    () =>
      DEMO_PRODUCTS.map((p) => ({
        _id: p.id,
        name: td(`products.${p.id}.name`),
        price: p.price,
        category: p.category,
        soldOut: p.soldOut ?? false,
        coverUrl: p.photos[0].src,
        featured: p.featured ?? false,
        fewLeft: p.fewLeft ?? false,
        backInStock: p.backInStock ?? false,
      })),
    [td],
  )
  const ownProducts: PreviewProduct[] = products.filter((p) => !p.hidden && !p.overLimit)
  const preview = previewProducts(ownProducts, samples, PREVIEW_SECTIONS_MAX)
  const previewCurrency = ownProducts.length === 0 ? DEMO_CURRENCY : shop.currency
  const sampleNote = !preview.sample ? null : ownProducts.length === 0 ? t("preview.sample") : t("preview.sampleFill")
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
    openingHours: shop.openingHours ?? null,
    deliveryAreas: shop.deliveryAreas ?? null,
    socials: shop.socials ?? {},
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

  const statusLine = (
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground" role="status" aria-live="polite">
      {status.icon}
      {status.text}
      {editor.saveState === "error" ? (
        <Button type="button" variant="link" size="sm" className="h-auto px-1" onClick={() => void editor.flush()}>
          {t("actions.retry")}
        </Button>
      ) : null}
    </p>
  )

  const publishHint = suspended
    ? null
    : promoLocked
      ? t("hints.promoLocked", { plan: promoPlan })
      : planLocked
        ? t("hints.planLocked")
        : blocking
          ? t("hints.blocking")
          : null

  const hasPromo = editor.draft.overrides.promo !== undefined
  const previewLook =
    previewMode === "live" ? editor.liveResolved : hasPromo && previewBanner === "event" ? editor.full : editor.resolved
  // The filter row as customers would see it: the look's setting, the plan and the seller's real product count.
  const previewFilters = filterAccess({
    mode: previewLook.sections.filters,
    entitled: mine.filtersEntitled,
    productCount: ownProducts.length,
  })

  const toolbar = (size: "default" | "compact") => (
    <div className="flex w-full flex-col gap-2">
      {showLiveToggle ? (
        <ChoiceGroup
          size={size}
          label={t("preview.show")}
          value={previewMode}
          onChange={setPreviewMode}
          options={[
            { value: "draft", label: t("preview.draft") },
            { value: "live", label: t("preview.live") },
          ]}
        />
      ) : null}
      {hasPromo && previewMode === "draft" ? (
        <ChoiceGroup
          size={size}
          label={t("preview.banner")}
          value={previewBanner}
          onChange={setPreviewBanner}
          options={[
            { value: "event", label: t("preview.eventBanner") },
            { value: "normal", label: t("preview.normalBanner") },
          ]}
        />
      ) : null}
      <ChoiceGroup
        size={size}
        label={t("preview.width")}
        value={previewWidth}
        onChange={setPreviewWidth}
        options={[
          { value: "phone", label: t("preview.phone") },
          { value: "wide", label: t("preview.wide") },
        ]}
      />
    </div>
  )

  const fullPreview = (className?: string) => (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {previewWidth === "phone" ? (
        <LookPreview look={previewLook} shop={headerShop} currency={previewCurrency} products={preview.products} filters={previewFilters} label={t("preview.label")} />
      ) : (
        <WidePreview
          look={previewLook}
          shop={headerShop}
          currency={previewCurrency}
          products={preview.products}
          filters={previewFilters}
          label={t("preview.wideLabel")}
        />
      )}
      {sampleNote ? <p className="text-center text-xs text-muted-foreground">{sampleNote}</p> : null}
    </div>
  )

  const publishButton = (className?: string, size?: "sm") => (
    <Button type="button" onClick={onPublish} disabled={!canPublish} className={className} size={size}>
      {busy === "publish" ? <Loader2Icon className="animate-spin" /> : null}
      {t("actions.publish")}
    </Button>
  )

  const viewShopHref = `/${shop.slug}`

  const notices = (
    <>
      {mine.hiddenByPlan ? (
        <Notice tone="warn">
          <p>{t("notices.hiddenByPlan")}</p>
          <Link href="/dashboard/billing" className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}>
            {t("actions.upgrade")}
          </Link>
        </Notice>
      ) : null}
      {mine.sectionsHiddenByPlan && !mine.hiddenByPlan ? (
        <Notice tone="warn">
          <p>{t("notices.sectionsHidden")}</p>
          <Link href="/dashboard/billing" className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}>
            {t("actions.upgrade")}
          </Link>
        </Notice>
      ) : null}
      {mine.promoHiddenByPlan && !mine.hiddenByPlan ? (
        <Notice tone="warn">
          <p>{t("notices.promoHidden")}</p>
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
    </>
  )

  const panelProps: SectionProps = { editor, mine, disabled: suspended, tiles, shop: { name: shop.name, logoUrl: shop.logoUrl } }
  const sectionTitle = t(`sections.${current.key}`)

  const dialogs = (
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
  )

  const onTabChange = (value: unknown) => {
    if (typeof value === "string" && (SECTION_KEYS as readonly string[]).includes(value)) select(value as SectionKey)
  }

  if (isDesktop) {
    return (
      <Tabs.Root value={section} onValueChange={onTabChange} orientation="vertical" className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight">{t("title")}</h1>
          {statusLine}
        </div>
        {notices}
        <div className="grid grid-cols-[176px_minmax(0,1fr)_300px] items-start gap-6">
          <div className="sticky top-20">
            <SectionTabs orientation="vertical" flags={flags} />
          </div>
          <Tabs.Panel value={section} className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5 focus-ring">
            <h2 className="font-heading text-lg font-bold tracking-tight">{sectionTitle}</h2>
            <SectionPanel section={current} props={panelProps} />
          </Tabs.Panel>
          <aside className="sticky top-20 flex max-h-[calc(100dvh-6rem)] flex-col gap-3 overflow-y-auto pb-2">
            <div className="flex flex-col gap-2">
              {publishButton("w-full")}
              {publishHint ? <p className="text-xs text-muted-foreground">{publishHint}</p> : null}
              <div className="flex flex-wrap items-center justify-between gap-1">
                <a
                  href={viewShopHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: justPublished ? "outline" : "ghost", size: "sm" })}
                >
                  {justPublished ? <CheckCircle2Icon className="text-success" /> : null}
                  {t("actions.viewShop")}
                  <ExternalLinkIcon />
                </a>
                {editor.unpublished ? (
                  <Button type="button" variant="ghost" size="sm" disabled={busy !== null || suspended} onClick={() => setConfirm("discard")}>
                    {t("actions.discard")}
                  </Button>
                ) : null}
              </div>
            </div>
            {toolbar("compact")}
            {/* Shorter screens: a smaller phone, so the actions above never scroll away. */}
            {fullPreview("[@media(max-height:960px)]:[zoom:0.74] [@media(max-height:860px)]:[zoom:0.6] [@media(max-height:760px)]:[zoom:0.5]")}
          </aside>
        </div>
        {dialogs}
      </Tabs.Root>
    )
  }

  return (
    <Tabs.Root value={section} onValueChange={onTabChange} orientation="horizontal" className="flex flex-col gap-4 pb-[45dvh]">
      {/* Sticky on phones: actions, the compact preview and the section tabs. */}
      <div
        ref={stickyTop}
        className="sticky top-14 z-20 -mx-4 -mt-5 flex flex-col gap-2 border-b bg-background px-4 pt-3 pb-2"
      >
        <div ref={actionsRow} className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <h1 className="font-heading text-lg font-bold tracking-tight">{t("title")}</h1>
            {statusLine}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={viewShopHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("actions.viewShop")}
              title={t("actions.viewShop")}
              className={buttonVariants({ variant: "ghost", size: "icon" })}
            >
              <ExternalLinkIcon />
            </a>
            {editor.unpublished ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("actions.discard")}
                title={t("actions.discard")}
                disabled={busy !== null || suspended}
                onClick={() => setConfirm("discard")}
              >
                <Undo2Icon />
              </Button>
            ) : null}
            {publishButton(undefined, "sm")}
          </div>
        </div>
        {publishHint ? <p className="text-xs text-muted-foreground">{publishHint}</p> : null}
        <div className="relative">
          {previewWidth === "phone" ? (
            <LookPreview
              compact
              look={previewLook}
              shop={headerShop}
              currency={previewCurrency}
              products={preview.products}
              filters={previewFilters}
              label={t("preview.label")}
              className="h-[26dvh]"
            />
          ) : (
            <div className="flex justify-center">
              <WidePreview
                look={previewLook}
                shop={headerShop}
                currency={previewCurrency}
                products={preview.products}
                filters={previewFilters}
                label={t("preview.wideLabel")}
              />
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="absolute right-2 bottom-2 bg-background"
            onClick={() => setPreviewOpen(true)}
          >
            <Maximize2Icon />
            {t("preview.expand")}
          </Button>
        </div>
        <SectionTabs orientation="horizontal" flags={flags} onTabClick={() => setSheetOpen(true)} />
      </div>

      {notices}
      <p className="text-sm text-muted-foreground">{t("sections.pick")}</p>

      <Drawer
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) setSheetTall(false)
        }}
        snapPoints={[sheetPx.short, sheetPx.tall]}
        snapPoint={sheetTall ? sheetPx.tall : sheetPx.short}
        onSnapPointChange={(point) => setSheetTall(point === sheetPx.tall)}
      >
        <DrawerContent aria-label={sectionTitle}>
          <div className="flex shrink-0 flex-col gap-2 border-b px-4 pt-2 pb-2 select-none">
            <DrawerHandle />
            <div className="flex items-center justify-between gap-2">
              <DrawerTitle>{sectionTitle}</DrawerTitle>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={sheetTall ? t("sheet.collapse") : t("sheet.expand")}
                  title={sheetTall ? t("sheet.collapse") : t("sheet.expand")}
                  onClick={() => setSheetTall((v) => !v)}
                >
                  {sheetTall ? <ChevronDownIcon /> : <ChevronUpIcon />}
                </Button>
                <DrawerClose render={<Button type="button" variant="ghost" size="icon" aria-label={t("sheet.close")} title={t("sheet.close")} />}>
                  <XIcon />
                </DrawerClose>
              </div>
            </div>
          </div>
          <DrawerBody>
            <Tabs.Panel value={section} className="flex flex-col gap-4 focus-ring">
              {notices}
              <SectionPanel section={current} props={panelProps} />
            </Tabs.Panel>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent side="bottom" className="items-center overflow-y-auto">
          <SheetTitle className="self-start">{t("preview.title")}</SheetTitle>
          <div className="w-full max-w-[320px]">{toolbar("default")}</div>
          {fullPreview()}
        </SheetContent>
      </Sheet>
      {dialogs}
    </Tabs.Root>
  )
}
