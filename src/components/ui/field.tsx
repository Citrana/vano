"use client"

import * as React from "react"
import { cn } from "cn"
import { Label } from "@/components/ui/label"

/**
 * Label + control + help text + error, wired for screen readers. Pass the
 * control as a render function so it receives the ids it needs.
 */
function Field({
  id,
  label,
  required,
  help,
  error,
  className,
  children,
}: {
  id: string
  label: React.ReactNode
  required?: boolean
  help?: React.ReactNode
  error?: string
  className?: string
  children: (props: {
    id: string
    "aria-invalid": boolean
    "aria-describedby": string | undefined
    required: boolean | undefined
  }) => React.ReactNode
}) {
  const helpId = help ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy, required })}
      {help && !error ? (
        <p id={helpId} className="text-xs text-muted-foreground">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export { Field }
