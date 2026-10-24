import { Inter_Tight, JetBrains_Mono } from "next/font/google"

export const fontSans = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
})

export const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
})
