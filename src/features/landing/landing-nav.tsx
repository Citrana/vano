"use client"

import { MenuIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useEffect, useState } from "react"
import { cn } from "cn"
import { Brand } from "@/components/shell/brand"
import { buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { LanguageSwitcher } from "@/features/i18n/language-switcher"
import { OpenShopCta } from "./open-shop-cta"

const LINKS = [
  { href: "#how", key: "navHow" },
  { href: "#why", key: "navWhy" },
  { href: "#demo", key: "navDemo" },
] as const

/** Sticky top bar; links collapse into a sheet below md. */
export function LandingNav() {
  const t = useTranslations("Landing")
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-colors",
        scrolled ? "border-border bg-background/85 backdrop-blur-md" : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
        <Brand />
        <nav aria-label={t("navLabel")} className="mx-auto hidden md:block">
          <ul className="flex items-center gap-1">
            {LINKS.map(({ href, key }) => (
              <li key={href}>
                <a href={href} className={buttonVariants({ variant: "ghost" })}>
                  {t(key)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <LanguageSwitcher className="hidden md:inline-flex" />
          <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "hidden md:inline-flex")}>
            {t("login")}
          </Link>
          <OpenShopCta compact />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "md:hidden")}
              aria-label={t("menu")}
            >
              <MenuIcon aria-hidden />
            </SheetTrigger>
            <SheetContent>
              <SheetTitle>
                <Brand />
              </SheetTitle>
              <nav aria-label={t("navLabel")}>
                <ul className="flex flex-col gap-1">
                  {LINKS.map(({ href, key }) => (
                    <li key={href}>
                      <a
                        href={href}
                        onClick={() => setOpen(false)}
                        className={cn(buttonVariants({ variant: "ghost" }), "w-full justify-start text-base")}
                      >
                        {t(key)}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="mt-auto flex flex-col gap-3">
                <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
                  {t("login")}
                </Link>
                <LanguageSwitcher className="self-start" />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
