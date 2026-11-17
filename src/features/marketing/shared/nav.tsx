"use client"

import { MenuIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { cn } from "cn"
import { Brand } from "@/components/shell/brand"
import { buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { LanguageSwitcher } from "@/features/i18n/language-switcher"
import { MARKETING_LINKS } from "./links"
import { OpenShopCta } from "./open-shop-cta"


function isCurrent(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Sticky marketing top bar; links collapse into a sheet below md. */
export function MarketingNav() {
  const t = useTranslations("Marketing")
  const pathname = usePathname()
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
        scrolled ? "border-border bg-background/85 backdrop-blur-md" : "border-transparent bg-background/0",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
        <Brand />
        <nav aria-label={t("navLabel")} className="mx-auto hidden md:block">
          <ul className="flex items-center gap-1">
            {MARKETING_LINKS.map(({ href, key }) => {
              const current = isCurrent(href, pathname)
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      buttonVariants({ variant: "ghost" }),
                      "relative",
                      current && "font-semibold after:absolute after:inset-x-3 after:bottom-1 after:h-0.5 after:rounded-full after:bg-foreground",
                    )}
                  >
                    {t(key)}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <LanguageSwitcher className="hidden lg:inline-flex" />
          <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "hidden md:inline-flex")}>
            {t("login")}
          </Link>
          <OpenShopCta compact hideWhenClosed />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "md:hidden")} aria-label={t("menu")}>
              <MenuIcon aria-hidden />
            </SheetTrigger>
            <SheetContent>
              <SheetTitle>
                <Brand />
              </SheetTitle>
              <nav aria-label={t("navLabel")}>
                <ul className="flex flex-col gap-1">
                  {MARKETING_LINKS.map(({ href, key }) => {
                    const current = isCurrent(href, pathname)
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          aria-current={current ? "page" : undefined}
                          onClick={() => setOpen(false)}
                          className={cn(
                            buttonVariants({ variant: "ghost" }),
                            "w-full justify-start text-base",
                            current && "bg-muted font-semibold",
                          )}
                        >
                          {t(key)}
                        </Link>
                      </li>
                    )
                  })}
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
