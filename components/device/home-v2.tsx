"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"

import { DeviceLoader } from "@/components/device/device-loader"
import { HeartLogo } from "@/components/hugtype/heart-logo"
import { FigmaLogo } from "@/components/playground/plugin-panel"
import { FloatingSheets } from "@/components/playground/floating-sheets"
import { usePlugin } from "@/components/playground/use-plugin"
import { FIGMA_URL } from "@/lib/site"

// La 3D ne tourne que dans le navigateur
const DeviceScene = dynamic(
  () => import("@/components/device/device-scene").then((m) => m.DeviceScene),
  { ssr: false, loading: () => <DeviceLoader progress={0} /> }
)

// DA « fiche technique » : fond gris clair, texte noir, filets fins, un gros titre
export function HomeV2() {
  const [open, setOpen] = useState(false)
  const [screensOn, setScreensOn] = useState(false)
  // l'intro du plugin (la veste qui glisse) attend que les écrans soient allumés
  const p = usePlugin({ introReady: screensOn })
  // zone libre sous le texte, où sont posées les planches et la vidéo
  const desk = useRef<HTMLDivElement>(null)

  // à l'arrivée, l'objet s'ouvre tout seul après un court instant
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 1400)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="flex min-h-svh flex-col bg-[#dddddd] text-[#222] md:h-svh md:overflow-hidden">
      {/* Bandeau du haut */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#bdbdbd] px-5 py-2 text-[13px] md:px-8">
        <p className="tracking-tight">HUGTYPE™ハグタイプ FIGMA PLUGIN</p>
        {/* L'action principale : installer le plugin */}
        <a
          href={FIGMA_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full bg-[#222] pr-4 pl-3.5 text-[10px] font-bold tracking-[0.08em] text-[#eee] uppercase transition-colors hover:bg-black focus-visible:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#222]"
        >
          <FigmaLogo className="h-3.5 w-auto" />
          Install for Figma — Free
        </a>
      </div>

      {/* Titre */}
      <h1 className="shrink-0 border-b border-[#bdbdbd] px-5 pt-3 pb-2 text-[clamp(3rem,7.5vw,7rem)] leading-[0.95] font-medium tracking-[-0.03em] md:px-8">
        HUGTYPE™
      </h1>

      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Texte, en deux colonnes étroites */}
        <div className="flex flex-col gap-6 px-5 pt-4 pb-6 md:px-8">
          <div className="grid max-w-[620px] gap-x-12 gap-y-4 text-[14px] leading-[1.3] tracking-[-0.01em] sm:grid-cols-2">
            <p>
              Make your text{" "}
              <HeartLogo className="inline-block h-[0.72em] w-auto -translate-y-[0.04em] align-baseline" />{" "}
              hug anything. HUGTYPE™ is a free Figma plugin to wrap a paragraph
              around a cutout, pour it inside a shape, or run a line along its
              outline.
            </p>
            <p>
              Try it on the device. Pick a mode on the top screen, drag the
              jacket in the preview, and roll the orange wheel to set the
              offset. Your text stays native and editable.
            </p>
          </div>

          <div ref={desk} className="min-h-0 flex-1" />

          <div className="flex flex-col gap-1 text-[13px] tracking-tight">
            <a
              href="https://www.bguillaume.info"
              target="_blank"
              rel="noreferrer"
              className="self-start text-[#6b6b6b] hover:text-[#222] focus-visible:text-[#222] focus-visible:outline-none"
            >
              Built by bguillaume.info
            </a>
          </div>
        </div>

        {/* L'objet */}
        <div className="relative h-[80svh] border-t border-[#bdbdbd] md:h-auto md:border-t-0 md:border-l">
          <DeviceScene
            p={p}
            open={open}
            onOpenChange={setOpen}
            onScreensOn={setScreensOn}
          />
          {/* Ouvrir / refermer, aussi au clavier */}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 cursor-pointer text-[13px] tracking-tight text-[#6b6b6b] transition-colors hover:text-[#222] focus-visible:text-[#222] focus-visible:outline-none"
          >
            {open ? "Close" : "Click to open"}
          </button>
        </div>
      </div>

      <FloatingSheets zone={desk} />
    </div>
  )
}
