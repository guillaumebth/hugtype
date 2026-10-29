import type { Metadata } from "next"

import { WireframeHome } from "@/components/device/wireframe-home"

// L'objet HugType en dessin technique (fil de fer). Pas indexée.
export const metadata: Metadata = {
  title: "HugType — Wireframe",
  robots: { index: false, follow: false },
}

export default function Page() {
  return <WireframeHome />
}
