import { Brand } from "@/components/shell/brand"
import { LanguageSwitcher } from "@/features/i18n/language-switcher"

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
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
