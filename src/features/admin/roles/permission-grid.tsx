"use client"

import { useTranslations } from "next-intl"
import { useEffect, useRef } from "react"
import { cn } from "cn"
import {
  PERMISSION_AREAS,
  PERMISSION_GROUPS,
  isSellerArea,
  type Permission,
  type PermissionArea,
} from "../../../../convex/lib/permissions"

/** A native checkbox that can show the "some selected" state. */
function Checkbox({
  checked,
  indeterminate = false,
  disabled,
  onChange,
  className,
}: {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
  className?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className={cn("size-4 shrink-0 accent-primary disabled:opacity-50", className)}
    />
  )
}

const permissionsIn = (area: PermissionArea): Permission[] =>
  PERMISSION_GROUPS[area].map((action) => `${area}.${action}` as Permission)

/**
 * Permissions grouped by area (from PERMISSION_GROUPS), with "select all
 * in this area". Permissions the editor can't grant are disabled (the
 * server refuses them anyway). `readOnly` shows the grid without editing.
 */
export function PermissionGrid({
  value,
  onChange,
  canGrant,
  readOnly = false,
}: {
  value: readonly string[]
  onChange?: (next: string[]) => void
  canGrant: (permission: Permission) => boolean
  readOnly?: boolean
}) {
  const t = useTranslations("Permissions")
  const tr = useTranslations("AdminRoles")
  const selected = new Set(value)
  const set = (permissions: Permission[], on: boolean) => {
    const next = new Set(value)
    for (const p of permissions) {
      if (on) next.add(p)
      else next.delete(p)
    }
    onChange?.([...next])
  }

  const area = (key: PermissionArea) => {
    const all = permissionsIn(key)
    const editable = readOnly ? [] : all.filter(canGrant)
    const count = all.filter((p) => selected.has(p)).length
    return (
      <fieldset key={key} className="flex flex-col gap-1 rounded-lg bg-muted/40 p-3">
        <legend className="sr-only">{t(`${key}.title`)}</legend>
        <label className="flex min-h-11 items-center gap-3 font-medium md:min-h-9">
          <Checkbox
            checked={count === all.length}
            indeterminate={count > 0 && count < all.length}
            disabled={editable.length === 0}
            onChange={(on) => set(editable, on)}
          />
          <span className="flex-1">{t(`${key}.title`)}</span>
          {editable.length > 0 && all.length > 1 ? (
            <span className="text-xs font-normal text-muted-foreground">{tr("selectAll")}</span>
          ) : null}
        </label>
        <div className="flex flex-col pl-7">
          {all.map((permission) => {
            const grantable = canGrant(permission)
            return (
              <label key={permission} className="flex min-h-11 items-center gap-3 text-sm md:min-h-8">
                <Checkbox
                  checked={selected.has(permission)}
                  disabled={readOnly || !grantable}
                  onChange={(on) => set([permission], on)}
                />
                <span className="flex flex-1 flex-col">
                  {t(permission)}
                  {!readOnly && !grantable ? (
                    <span className="text-xs text-muted-foreground">{tr("notYours")}</span>
                  ) : null}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 md:grid-cols-2">{PERMISSION_AREAS.filter((a) => !isSellerArea(a)).map(area)}</div>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">{tr("sellerAreas")}</h3>
        <div className="grid gap-2 md:grid-cols-3">{PERMISSION_AREAS.filter(isSellerArea).map(area)}</div>
      </div>
    </div>
  )
}
