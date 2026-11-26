"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import type { AuthErrorKind } from "./auth-error"

/** The translated text for a classified auth error (never a raw server message). */
export function useAuthErrorMessage() {
  const t = useTranslations("Auth")
  const te = useTranslations("Errors")
  return useCallback(
    (result: AuthErrorKind): string => {
      switch (result.kind) {
        case "code":
          return te(result.code)
        case "invalidCredentials":
          return t("invalidCredentials")
        case "accountExists":
          return t("accountExists")
        case "invalidCode":
          return t("invalidCode")
        default:
          return te("UNKNOWN")
      }
    },
    [t, te]
  )
}
