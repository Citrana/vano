"use client"

import { useAuthActions } from "@convex-dev/auth/react"
import { LogOutIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function SignOutButton() {
  const t = useTranslations("Common")
  const { signOut } = useAuthActions()
  const router = useRouter()
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        await signOut()
        router.replace("/login")
      }}
    >
      <LogOutIcon />
      <span className="hidden sm:inline">{t("signOut")}</span>
      <span className="sr-only sm:hidden">{t("signOut")}</span>
    </Button>
  )
}
