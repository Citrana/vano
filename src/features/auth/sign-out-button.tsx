"use client"

import { useAuthActions } from "@convex-dev/auth/react"
import { LogOutIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

/** Signs out, then goes to the login page. */
export function useSignOut() {
  const { signOut } = useAuthActions()
  const router = useRouter()
  return async () => {
    await signOut()
    router.replace("/login")
  }
}

/** In top bars the label hides on phones; `showLabel` always shows it. */
export function SignOutButton({
  variant = "ghost",
  showLabel = false,
}: {
  variant?: "ghost" | "outline"
  showLabel?: boolean
}) {
  const t = useTranslations("Common")
  const signOut = useSignOut()
  return (
    <Button variant={variant} onClick={signOut}>
      <LogOutIcon />
      {showLabel ? (
        t("signOut")
      ) : (
        <>
          <span className="hidden sm:inline">{t("signOut")}</span>
          <span className="sr-only sm:hidden">{t("signOut")}</span>
        </>
      )}
    </Button>
  )
}
