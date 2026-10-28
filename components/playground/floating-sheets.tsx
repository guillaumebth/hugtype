"use client"

import Image from "next/image"
import { useEffect, useState, useSyncExternalStore } from "react"

import {
  FloatingVideo,
  VIDEO_H,
  VIDEO_W,
} from "@/components/playground/floating-video"
import { Lightbox } from "@/components/playground/lightbox"
import { useFloating } from "@/hooks/use-floating"
import { cn } from "@/lib/utils"

type Sheet = {
  id: string
  title: string
  // légende courte sous la planche (v2), si le titre est trop long
  caption?: string
  src: string
  width: number
  height: number
  side: "left" | "right"
  // position dans la zone libre de son côté (0 à 1) et inclinaison
  fx: number
  fy: number
  rot: number
}

// Des tirages faits avec le plugin, posés autour du panneau
const SHEETS: Sheet[] = [
  {
    id: "user-guide",
    title: "User guide",
    src: "/sheets/user-guide.jpg",
    width: 1393,
    height: 920,
    side: "left",
    fx: 0.15,
    fy: 0.08,
    rot: -7,
  },
  {
    id: "zero-gravity",
    title: "Zero gravity",
    src: "/sheets/zero-gravity.jpg",
    width: 1045,
    height: 1480,
    side: "left",
    fx: 0.75,
    fy: 0.42,
    rot: 5,
  },
  {
    id: "salomon",
    title: "Salomon Cross Low Drawstring",
    caption: "Salomon Cross Low",
    src: "/sheets/salomon.jpg",
    width: 1050,
    height: 1491,
    side: "left",
    fx: 0.12,
    fy: 0.85,
    rot: -3,
  },
  {
    id: "ootd",
    title: "OOTD",
    src: "/sheets/ootd.jpg",
    width: 1050,
    height: 1491,
    side: "right",
    fx: 0.6,
    fy: 0.05,
    rot: 6,
  },
  {
    id: "interface",
    title: "Interface",
    src: "/sheets/interface.jpg",
    width: 1393,
    height: 920,
    side: "right",
    fx: 0.2,
    fy: 0.45,
    rot: -5,
  },
]

const PANEL_HALF = 170 + 48 // moitié du panneau + marge
const HEADER_HALF = 320 // moitié de la zone du titre
const EDGE = 24
// La vidéo est posée parmi les feuilles, en bas à droite
const VIDEO = { fx: 0.55, fy: 0.97, rot: 3 }

function sizeOf(s: Sheet) {
  const w = s.width > s.height ? 210 : 140
  return { w, h: (w * s.height) / s.width }
}

// Taille de la fenêtre, lue sans passer par un effet
function subscribe(cb: () => void) {
  window.addEventListener("resize", cb)
  return () => window.removeEventListener("resize", cb)
}
const getViewport = () => `${window.innerWidth}x${window.innerHeight}`

function layout(vw: number, vh: number) {
  const sideW = vw / 2 - PANEL_HALF
  // pas assez de place sur les côtés (mobile, petite fenêtre) : on n'affiche rien
  if (sideW < 230 || vh < 640) return null
  return SHEETS.map((s) => {
    const { w, h } = sizeOf(s)
    // on garde les feuilles hors de la zone du titre
    const span = Math.max(0, Math.min(sideW, vw / 2 - HEADER_HALF) - w - EDGE)
    const x =
      s.side === "left" ? EDGE + s.fx * span : vw - EDGE - w - s.fx * span
    const y = EDGE + s.fy * Math.max(0, vh - h - EDGE * 2)
    return { sheet: s, x, y, w, h }
  })
}

// v2 : tout est posé dans une zone de la page (un rectangle à l'écran), comme sur un bureau
type Zone = { x: number; y: number; w: number; h: number }
const IN_ZONE: Record<string, { fx: number; fy: number; rot: number }> = {
  // deux rangées, pour que chaque légende « Fig. » reste visible
  "user-guide": { fx: 0, fy: 0.02, rot: -4 },
  "zero-gravity": { fx: 0.5, fy: 0, rot: 3 },
  ootd: { fx: 1, fy: 0.03, rot: 4 },
  salomon: { fx: 0.01, fy: 0.94, rot: -3 },
  interface: { fx: 0.4, fy: 0.94, rot: 2 },
  video: { fx: 1, fy: 0.94, rot: -2 },
}

// numéros des figures, dans l'ordre de lecture (rangée du haut, puis du bas)
const FIG_ORDER = [
  "user-guide",
  "zero-gravity",
  "ootd",
  "salomon",
  "interface",
  "video",
]
function figNumber(id: string) {
  return `FIG. ${String(FIG_ORDER.indexOf(id) + 1).padStart(2, "0")}`
}

function zoneLayout(z: Zone) {
  if (z.w < 420 || z.h < 300) return null
  const at = (id: string, w: number, h: number) => {
    const p = IN_ZONE[id]
    return {
      x: z.x + p.fx * Math.max(0, z.w - w),
      y: z.y + p.fy * Math.max(0, z.h - h),
      rot: p.rot,
    }
  }
  return {
    items: SHEETS.map((s) => {
      const { w, h } = sizeOf(s)
      const { x, y, rot } = at(s.id, w, h)
      return { sheet: { ...s, rot }, x, y, w, h }
    }),
    video: at("video", VIDEO_W, VIDEO_H),
  }
}

// Position de l'élément à l'écran, mise à jour quand la page change de taille
function useZone(ref?: React.RefObject<HTMLElement | null>) {
  const [zone, setZone] = useState<Zone | null>(null)
  useEffect(() => {
    const el = ref?.current
    if (!el) return
    function measure() {
      const r = el!.getBoundingClientRect()
      setZone({ x: r.left, y: r.top, w: r.width, h: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener("resize", measure)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [ref])
  return zone
}

function videoPlace(vw: number, vh: number) {
  const span = Math.max(
    0,
    Math.min(vw / 2 - PANEL_HALF, vw / 2 - HEADER_HALF) - VIDEO_W - EDGE
  )
  return {
    x: vw - EDGE - VIDEO_W - VIDEO.fx * span,
    y: EDGE + VIDEO.fy * Math.max(0, vh - VIDEO_H - EDGE * 2),
    rot: VIDEO.rot,
  }
}

// `zone` (v2) : les feuilles sont posées dans cet élément au lieu d'entourer le panneau
export function FloatingSheets({
  zone: zoneRef,
}: { zone?: React.RefObject<HTMLElement | null> } = {}) {
  const viewport = useSyncExternalStore(subscribe, getViewport, () => "")
  const zone = useZone(zoneRef)
  // sur le fond clair de la v2, les feuilles sont posées à plat, sans ombre
  const flat = Boolean(zoneRef)
  const [z, setZ] = useState<Record<string, number>>({})
  const [top, setTop] = useState(10)
  const [open, setOpen] = useState<Sheet | null>(null)

  if (!viewport) return null
  const [vw, vh] = viewport.split("x").map(Number)
  const inZone = zoneRef ? (zone ? zoneLayout(zone) : null) : null
  const items = zoneRef ? inZone?.items : layout(vw, vh)
  // pas de place pour les feuilles : la vidéo reste seule, en bas à droite
  // (sauf sur l'accueil, où elle passerait sur l'objet 3D : on ne montre rien)
  if (!items) return zoneRef ? null : <FloatingVideo flat={flat} />

  function front(id: string) {
    setTop((t) => t + 1)
    setZ((m) => ({ ...m, [id]: top + 1 }))
  }

  return (
    <>
      {items.map((it) => (
        <FloatingSheet
          key={it.sheet.id}
          {...it}
          z={z[it.sheet.id] ?? 1}
          flat={flat}
          // v2 : chaque planche est une « figure » numérotée, comme dans une fiche technique
          caption={
            flat
              ? {
                  n: figNumber(it.sheet.id),
                  title: it.sheet.caption ?? it.sheet.title,
                }
              : undefined
          }
          onFront={() => front(it.sheet.id)}
          onOpen={() => setOpen(it.sheet)}
        />
      ))}

      <FloatingVideo
        place={inZone?.video ?? videoPlace(vw, vh)}
        z={z.video ?? 1}
        flat={flat}
        caption={
          flat
            ? {
                n: figNumber("video"),
                title: "HugType in motion",
              }
            : undefined
        }
        onFront={() => front("video")}
      />

      {open && (
        <Lightbox label={open.title} onClose={() => setOpen(null)}>
          <Image
            src={open.src}
            alt={open.title}
            width={open.width}
            height={open.height}
            sizes="100vw"
            style={{
              width: `min(84vw, calc(82svh * ${open.width / open.height}))`,
            }}
            className="h-auto shadow-[0_16px_48px_rgba(0,0,0,0.3)]"
          />
        </Lightbox>
      )}
    </>
  )
}

function FloatingSheet({
  sheet,
  x,
  y,
  w,
  h,
  z,
  flat,
  caption,
  onFront,
  onOpen,
}: {
  flat?: boolean
  caption?: { n: string; title: string }
  sheet: Sheet
  x: number
  y: number
  w: number
  h: number
  z: number
  onFront: () => void
  onOpen: () => void
}) {
  const { ref, pos, handlers } = useFloating(onOpen)

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={`Open ${sheet.title}`}
      {...handlers}
      onPointerDown={(e) => {
        onFront()
        handlers.onPointerDown(e)
      }}
      style={{
        left: pos?.x ?? x,
        top: pos?.y ?? y,
        width: w,
        height: h,
        zIndex: 20 + z,
        rotate: `${sheet.rot}deg`,
      }}
      className={cn(
        "fixed hidden cursor-grab touch-none select-none focus-visible:outline-2 focus-visible:outline-white active:cursor-grabbing md:block",
        !flat && "shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
      )}
    >
      <Image
        src={sheet.src}
        alt=""
        width={sheet.width}
        height={sheet.height}
        sizes="210px"
        draggable={false}
        className="pointer-events-none size-full object-cover"
      />
      {caption && (
        <div className="pointer-events-none absolute top-full left-0 mt-1.5 text-[10px] leading-tight whitespace-nowrap text-[#444]">
          <span className="font-mono text-[#6b6b6b]">{caption.n}</span>{" "}
          {caption.title}
        </div>
      )}
    </div>
  )
}
