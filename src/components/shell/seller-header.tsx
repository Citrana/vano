"use client"

import { useQuery } from "convex/react"
import { ExternalLinkIcon, LayoutGridIcon, SettingsIcon, ShieldIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"
import { api } from "../../../convex/_generated/api"
import { buttonVariants } from "@/components/ui/button"
import { SignOutButton } from "@/features/auth/sign-out-button"
import { LanguageSwitcher } from "@/features/i18n/language-switcher"
import { Brand } from "./brand"

/** Seller top bar; on phones the section links sit in a second row. */
export function SellerHeader() {
  const t = useTranslations("Seller")
  const pathname = usePathname()
  const shop = useQuery(api.shops.myShop, {})
  const viewer = useQuery(api.users.viewer, {})
  const links = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutGridIcon, active: pathname === "/dashboard" || pathname.startsWith("/dashboard/products") },
    { href: "/dashboard/settings", label: t("settings"), icon: SettingsIcon, active: pathname === "/dashboard/settings" },
    // Admins who also sell can switch to the admin (the server checks access).
    ...(viewer?.isAdmin ? [{ href: "/admin", label: t("admin"), icon: ShieldIcon, active: false }] : []),
  ]

  const nav = (
    <nav aria-label={t("menu")} className="flex gap-1">
      {links.map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(buttonVariants({ variant: active ? "secondary" : "ghost" }), "flex-1 sm:flex-none")}
        >
          <Icon />
          {label}
        </Link>
      ))}
      {shop ? (
        <a
          href={`/${shop.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "ghost" }), "hidden md:inline-flex")}
        >
          <ExternalLinkIcon />
          {t("viewShop")}
        </a>
      ) : null}
    </nav>
  )

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-6">
          <Brand href="/dashboard" />
          <div className="hidden sm:block">{nav}</div>
        </div>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <SignOutButton />
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-4 pb-2 sm:hidden">{nav}</div>
    </header>
  )
}
