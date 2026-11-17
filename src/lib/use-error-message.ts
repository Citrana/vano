"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { errorCodeOf } from "../../convex/lib/errors"

/** Turns a caught Convex error into a translated message (`Errors.<code>`). */
export function useErrorMessage() {
  const t = useTranslations("Errors")
  return useCallback((error: unknown) => {
    const code = errorCodeOf(error)
    return code ? t(code) : t("UNKNOWN")
  }, [t])
}
