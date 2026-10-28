import type { Metadata } from "next"

import { Home } from "@/components/playground/home"

// L'ancienne page d'accueil (panneau à plat, fond noir), gardée pour mémoire. Pas indexée.
export const metadata: Metadata = {
  title: "HugType — v1",
  robots: { index: false, follow: false },
}

export default function Page() {
  return <Home />
}
