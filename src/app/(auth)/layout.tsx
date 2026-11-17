import { Brand } from "@/components/shell/brand"
import { LanguageSwitcher } from "@/features/i18n/language-switcher"

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative isolate flex flex-1 flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -z-10 size-[36rem] -translate-x-1/2 rounded-full bg-blush/70 blur-3xl" />
      <header className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Brand />
        <LanguageSwitcher />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-12 sm:items-center sm:pt-0">
        {children}
      </main>
    </div>
  )
}
