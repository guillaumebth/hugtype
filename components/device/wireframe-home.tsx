"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useState } from "react"

import type { WireMode } from "@/components/device/wireframe-scene"

// La 3D ne tourne que dans le navigateur
const WireframeScene = dynamic(
  () =>
    import("@/components/device/wireframe-scene").then((m) => m.WireframeScene),
  { ssr: false }
)

const KEY =
  "inline-flex h-8 cursor-pointer items-center rounded-full bg-[#2e2e30] px-4 text-[10px] font-bold tracking-[0.08em] text-[#f2f2f2] uppercase transition-colors hover:bg-[#3a3a3d] focus-visible:bg-[#3a3a3d] focus-visible:outline-none"

export function WireframeHome() {
  const [mode, setMode] = useState<WireMode>("lines")
  const [open, setOpen] = useState(false)

  // l'objet s'ouvre tout seul après un court instant, comme sur l'accueil
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 1200)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-black text-[#ececec]">
      <div className="flex shrink-0 items-center justify-between gap-4 px-5 pt-5 pb-2 text-[13px] md:px-8 md:pt-7">
        <p className="tracking-tight">
          HUGTYPE™ハグタイプ
          <span className="hidden sm:inline"> — WIREFRAME</span>
        </p>
        <Link href="/" className={KEY}>
          ← Device
        </Link>
      </div>

      <main className="relative min-h-0 flex-1">
        <WireframeScene mode={mode} open={open} />
        <p className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-wider text-[#8c8c8c] uppercase">
          Drag to rotate · Scroll to zoom
        </p>
      </main>

      <div className="flex shrink-0 justify-center gap-2 px-5 pt-2 pb-5">
        <button
          type="button"
          onClick={() => setMode((m) => (m === "lines" ? "mesh" : "lines"))}
          className={KEY}
        >
          {mode === "lines" ? "Show mesh" : "Show lines"}
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={KEY}
        >
          {open ? "Close" : "Open"}
        </button>
      </div>
    </div>
  )
}
