import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { Providers } from "./providers"
import { BarcodeScannerGlobal } from "./barcode-scanner-global"

export const metadata: Metadata = {
  applicationName: "PrimePOS",
  title: "PrimePOS - Multi-Business Point of Sale Platform",
  description: "A comprehensive SaaS POS platform for retail, restaurant, pharmacy, wholesale, and more.",
  manifest: "/manifest.webmanifest",
  themeColor: "#0f172a",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PrimePOS",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans">
        <Providers>
          <BarcodeScannerGlobal />
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
