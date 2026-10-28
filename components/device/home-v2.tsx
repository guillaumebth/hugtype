"use client"

import dynamic from "next/dynamic"
import { useEffect, useState, useSyncExternalStore } from "react"

import { DeviceLoader } from "@/components/device/device-loader"
import { HeartLogo } from "@/components/hugtype/heart-logo"
import { FloatingVideo } from "@/components/playground/floating-video"
import { FigmaLogo } from "@/components/playground/plugin-panel"
import { usePlugin } from "@/components/playground/use-plugin"
import { FIGMA_URL } from "@/lib/site"

// La 3D ne tourne que dans le navigateur
const DeviceScene = dynamic(
  () => import("@/components/device/device-scene").then((m) => m.DeviceScene),
  { ssr: false, loading: () => <DeviceLoader progress={0} /> }
)

const PHONE = "(max-width: 767px)"
function subscribePhone(cb: () => void) {
  const m = window.matchMedia(PHONE)
  m.addEventListener("change", cb)
  return () => m.removeEventListener("change", cb)
}
const isPhone = () => window.matchMedia(PHONE).matches

// DA « fiche technique » sur fond noir (texte clair, filets fins, un gros titre), tout centré
export function HomeV2() {
  const [open, setOpen] = useState(false)
  const [screensOn, setScreensOn] = useState(false)
  // l'intro du plugin (la veste qui glisse) attend que les écrans soient allumés
  const p = usePlugin({ introReady: screensOn })

  // Sur téléphone, la page défile même au doigt sur l'objet ; un tap le passe en plein écran,
  // où tous les gestes vont à l'objet (glisser la veste, tourner le cadran, la molette)
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false)
  const [focus, setFocus] = useState(false)
  const focused = phone && focus
  useEffect(() => {
    if (!focused) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [focused])

  // la vidéo ne se charge que sur grand écran, une fois la page affichée
  const [videoReady, setVideoReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVideoReady(true), 2500)
    return () => clearTimeout(t)
  }, [])

  // à l'arrivée, l'objet s'ouvre tout seul après un court instant
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 1400)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="flex min-h-svh flex-col bg-black text-[#ececec] md:h-svh md:overflow-hidden">
      {/* Bandeau du haut */}
      <div className="flex shrink-0 items-center justify-between gap-4 px-5 pt-5 pb-2 text-[13px] md:px-8 md:pt-7">
        <p className="tracking-tight">HUGTYPE™ハグタイプ FIGMA PLUGIN</p>
        {/* L'action principale : installer le plugin */}
        <a
          href={FIGMA_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full bg-[#2e2e30] pr-4 pl-3.5 text-[10px] font-bold tracking-[0.08em] text-[#f2f2f2] uppercase transition-colors hover:bg-[#3a3a3d] focus-visible:bg-[#3a3a3d] focus-visible:outline-none"
        >
          <FigmaLogo className="h-3.5 w-auto" />
          Install for Figma — Free
        </a>
      </div>

      {/* Titre, centré */}
      <h1 className="shrink-0 px-5 pt-3 pb-2 text-center text-[#ff3410] text-[clamp(3rem,7.5vw,7rem)] leading-[0.95] font-medium tracking-[-0.03em] md:px-8">
        HUGTYPE™
      </h1>

      {/* Texte, en deux colonnes étroites, centré */}
      <div className="mx-auto grid w-full max-w-[640px] shrink-0 gap-x-12 gap-y-4 px-5 pt-4 pb-2 text-[14px] leading-[1.3] tracking-[-0.01em] sm:grid-cols-2">
        <p>
          Make your text{" "}
          <HeartLogo className="inline-block h-[0.72em] w-auto -translate-y-[0.04em] align-baseline" />{" "}
          hug anything. HUGTYPE™ is a free Figma plugin to wrap a paragraph
          around a cutout, pour it inside a shape, or run a line along its
          outline.
        </p>
        <p>
          Try it on the device. Pick a mode on the top screen, drag the jacket
          in the preview, and roll the orange wheel to set the offset. Your text
          stays native and editable.
        </p>
      </div>

      {/* L'objet, centré, sur toute la place restante */}
      <main className="relative h-[80svh] shrink-0 md:h-auto md:min-h-0 md:flex-1">
        <div
          className={
            focused
              ? "fixed inset-0 z-40 touch-none bg-black"
              : "absolute inset-0"
          }
        >
          <DeviceScene
            p={p}
            open={open}
            onOpenChange={setOpen}
            onScreensOn={setScreensOn}
            focus={focused}
          />
          {focused && (
            <button
              type="button"
              onClick={() => setFocus(false)}
              className="absolute top-4 right-4 inline-flex h-8 cursor-pointer items-center rounded-full bg-[#2e2e30] px-4 text-[10px] font-bold tracking-[0.08em] text-[#f2f2f2] uppercase focus-visible:outline-none"
            >
              Done
            </button>
          )}
        </div>
        {/* téléphone, hors plein écran : un tap sur l'objet l'ouvre en plein écran (la page défile toujours) */}
        {phone && !focused && (
          <button
            type="button"
            aria-label="Use the device full screen"
            onClick={() => {
              setOpen(true)
              setFocus(true)
            }}
            className="absolute inset-0 z-10 flex cursor-pointer items-end justify-center pb-10 focus-visible:outline-none"
          >
            <span className="rounded-full bg-[#2e2e30] px-4 py-2 text-[10px] font-bold tracking-[0.08em] text-[#f2f2f2] uppercase">
              Tap to use
            </span>
          </button>
        )}
        {/* Ouvrir / refermer, aussi au clavier */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 cursor-pointer text-[13px] tracking-tight text-[#8c8c8c] transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none"
        >
          {open ? "Close" : "Click to open"}
        </button>
      </main>

      <footer className="flex shrink-0 justify-center px-5 py-3 text-[13px] tracking-tight">
        <a
          href="https://www.bguillaume.info"
          target="_blank"
          rel="noreferrer"
          className="text-[#8c8c8c] hover:text-white focus-visible:text-white focus-visible:outline-none"
        >
          Built by bguillaume.info
        </a>
      </footer>

      {/* La vidéo en vignette, en bas à droite, sur grand écran seulement (pas chargée sur téléphone) */}
      {!phone && videoReady && <FloatingVideo flat />}
    </div>
  )
}
