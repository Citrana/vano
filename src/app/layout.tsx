import type { Metadata, Viewport } from "next"
import { Fraunces, Geist, Geist_Mono } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale } from "next-intl/server"
import { Toaster } from "sonner"
import { ConvexClientProvider } from "@/lib/convex-client-provider"
import { siteUrl } from "@/lib/site"
import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] })

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Vano", template: "%s · Vano" },
  description: "Open your fashion shop online and get orders on WhatsApp.",
}

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#faf7f2",
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale()
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <ConvexClientProvider>{children}</ConvexClientProvider>
          <Toaster position="top-center" richColors closeButton />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
