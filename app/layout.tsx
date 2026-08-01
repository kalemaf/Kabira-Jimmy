import { Space_Grotesk, JetBrains_Mono } from "next/font/google"
import type { Metadata } from "next"

import "./globals.css"
import { Providers } from "@/components/providers"
import { cn } from "@/lib/utils"

// Space Grotesk — a geometric, technical-leaning sans-serif in the same
// spirit as the industrial/engineering-style "Metrology" font requested,
// but legible at body-text sizes across the whole app (Google Fonts,
// properly licensed for commercial use, self-hosted via next/font).
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" })

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Nexcgen — Loans Management",
  description:
    "Enterprise-grade loan and savings management system for SACCOs, MFIs, and cooperative societies.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={cn("antialiased", jetbrainsMono.variable, "font-sans", spaceGrotesk.variable)}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
