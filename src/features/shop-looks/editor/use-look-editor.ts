"use client"

import { useMutation } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { api } from "../../../../convex/_generated/api"
import { sameLook, shownLook, withoutPromo } from "../../../../convex/lib/looks/clean"
import { lookProblems, type LookProblem } from "../../../../convex/lib/looks/contrast"
import { FREE_LOOK, presetLook } from "../../../../convex/lib/looks/presets"
import { DEFAULT_PROFILE } from "../../../../convex/lib/looks/profile"
import { mapBannerImage, resolveColors, resolveLook, type ResolvedLook } from "../../../../convex/lib/looks/resolve"
import type { LookOverrides, PresetId, StoredLook } from "../../../../convex/lib/looks/validators"

export type MineLook = FunctionReturnType<typeof api.shopLooks.mine>

/** "dirty": edited, waiting for the autosave; "error": the last save failed. */
export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error"

const AUTOSAVE_MS = 800

/**
 * The "Shop look" editor state (CLAUDE.md "Shop looks"). The draft lives
 * here, so the preview updates instantly; every change is autosaved
 * (debounced, one save at a time, the latest wins) with `saveDraft`.
 * `flush` waits for pending edits before publishing.
 */
export function useLookEditor(mine: MineLook) {
  const saveDraft = useMutation(api.shopLooks.saveDraft)
  const publishMutation = useMutation(api.shopLooks.publish)
  const discardMutation = useMutation(api.shopLooks.discardDraft)

  const [draft, setDraft] = useState<StoredLook>(mine.editing)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [saveError, setSaveError] = useState<unknown>(null)
  /** Blob URLs for photos uploaded in this session (until the server URL arrives). */
  const [localUrls, setLocalUrls] = useState<Record<string, string>>({})

  const pending = useRef<StoredLook | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const chain = useRef<Promise<void>>(Promise.resolve())

  const runSave = useCallback(async () => {
    const look = pending.current
    if (!look) return
    pending.current = null
    setSaveState("saving")
    try {
      await saveDraft({ look })
      if (!pending.current) setSaveState("saved")
      setSaveError(null)
    } catch (error) {
      // Keep the newest unsaved edit for the retry.
      pending.current ??= look
      setSaveState("error")
      setSaveError(error)
    }
  }, [saveDraft])

  const enqueue = useCallback(() => {
    chain.current = chain.current.then(runSave)
    return chain.current
  }, [runSave])

  /** Saves pending edits now; resolves true when nothing is left unsaved. */
  const flush = useCallback(async () => {
    window.clearTimeout(timer.current)
    await enqueue()
    return pending.current === null
  }, [enqueue])

  const update = useCallback(
    (next: StoredLook | ((current: StoredLook) => StoredLook)) => {
      setDraft((current) => {
        const value = typeof next === "function" ? next(current) : next
        pending.current = value
        return value
      })
      setSaveState("dirty")
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void enqueue(), AUTOSAVE_MS)
    },
    [enqueue],
  )

  // Save what's left when leaving the page; warn on a hard unload.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (pending.current) event.preventDefault()
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      window.clearTimeout(timer.current)
      if (pending.current) void enqueue()
    }
  }, [enqueue])

  const setOverride = useCallback(
    <K extends keyof LookOverrides>(key: K, value: LookOverrides[K] | undefined) =>
      update((current) => ({ ...current, overrides: { ...current.overrides, [key]: value } })),
    [update],
  )

  /**
   * One tap: the preset's colours, buttons and banner. A seller's own
   * photo, their event & promo banner and their profile photo are kept.
   */
  const applyPreset = useCallback(
    (preset: PresetId) =>
      update((current) => {
        const { banner, promo, profile } = current.overrides
        return {
          v: 1,
          preset,
          overrides: { ...(banner?.kind === "photo" ? { banner } : {}), ...(promo ? { promo } : {}), ...(profile ? { profile } : {}) },
        }
      }),
    [update],
  )

  /** Back to the preset's look; the event & promo banner and the profile photo are their own things and stay. */
  const resetToPreset = useCallback(
    () =>
      update((current) => {
        const { promo, profile } = current.overrides
        return { ...presetLook(current.preset), overrides: { ...(promo ? { promo } : {}), ...(profile ? { profile } : {}) } }
      }),
    [update],
  )

  /** A contrast check's one-tap fix: the accent, the background or the profile border colour. */
  const applyFix = useCallback(
    (fix: NonNullable<LookProblem["fix"]>) =>
      update((current) => {
        if (fix.field === "profileBorder") {
          const profile = current.overrides.profile ?? DEFAULT_PROFILE
          return { ...current, overrides: { ...current.overrides, profile: { ...profile, borderColor: { kind: "custom", hex: fix.value } } } }
        }
        const colors = resolveColors(current)
        const base = current.overrides.colors ?? { accent: colors.primary, background: colors.background }
        return { ...current, overrides: { ...current.overrides, colors: { ...base, [fix.field]: fix.value } } }
      }),
    [update],
  )

  const publish = useCallback(async () => {
    if (!(await flush())) return false
    await publishMutation({})
    setSaveState("idle")
    return true
  }, [flush, publishMutation])

  const discard = useCallback(async () => {
    window.clearTimeout(timer.current)
    pending.current = null
    await chain.current
    await discardMutation({})
    setDraft(mine.published ?? FREE_LOOK)
    setSaveState("idle")
    setSaveError(null)
  }, [discardMutation, mine.published])

  const addLocalUrl = useCallback((id: string, url: string) => setLocalUrls((urls) => ({ ...urls, [id]: url })), [])

  const urls = useMemo(() => ({ ...mine.bannerUrls, ...localUrls }), [mine.bannerUrls, localUrls])
  const withUrls = useCallback(
    (look: StoredLook): ResolvedLook<string> => mapBannerImage(resolveLook(look), (id) => urls[id] ?? null),
    [urls],
  )
  /** The draft with its normal banner (what shows when no promo is live). */
  const resolved = useMemo(() => withUrls(withoutPromo(draft)), [withUrls, draft])
  /** The draft with its event & promo banner, if any. */
  const full = useMemo(() => withUrls(draft), [withUrls, draft])
  const problems = useMemo(() => lookProblems(full), [full])
  // The same rule as the public pages (`visibleLook`).
  const live = useMemo(
    () =>
      shownLook(mine.published, {
        entitled: mine.entitled,
        promoShown: mine.promoLive && mine.promoEntitled,
        decorationShown: mine.decorationLive,
      }),
    [mine.entitled, mine.published, mine.promoLive, mine.promoEntitled, mine.decorationLive],
  )
  const unpublished = !sameLook(draft, mine.published ?? FREE_LOOK)

  return {
    draft,
    resolved,
    full,
    problems,
    /** What visitors see right now. */
    liveResolved: useMemo(() => withUrls(live), [withUrls, live]),
    unpublished,
    saveState,
    saveError,
    urls,
    update,
    setOverride,
    applyPreset,
    resetToPreset,
    applyFix,
    flush,
    publish,
    discard,
    addLocalUrl,
  }
}

export type LookEditorState = ReturnType<typeof useLookEditor>
