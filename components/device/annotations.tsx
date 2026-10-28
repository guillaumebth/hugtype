"use client"

import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

// Légendes façon fiche technique, reliées à l'objet par un filet fin.
// Positions dans le repère de l'objet ouvert (unités Blender, cf. blender/hugtype-device.blend).
const ANNOTATIONS = [
  {
    id: "keys",
    n: "01",
    label: "Mode keys",
    hint: "Around, inside, outline",
    side: "left",
    at: [-2.245, 3.735, 0],
  },
  {
    id: "preview",
    n: "02",
    label: "Preview",
    hint: "Drag the jacket",
    side: "left",
    at: [-2.245, 1.745, 0],
  },
  {
    id: "dial",
    n: "03",
    label: "Offset dial",
    hint: "Turn to set the offset",
    side: "left",
    at: [-1.77, -2.14, 0],
  },
  {
    id: "wheel",
    n: "04",
    label: "Wheel",
    hint: "Roll it, same thing",
    side: "right",
    at: [2.64, -2.72, -0.225],
  },
] as const

// bords gauche et droit de l'objet (la molette dépasse à droite)
const EDGE_LEFT = -2.6
const EDGE_RIGHT = 2.85
const GAP = 22 // px entre le bord de l'objet et la légende
const LABEL_W = 132 // px, largeur réservée à une légende

// Le calque HTML des légendes, posé par-dessus la 3D
export function AnnotationLayer({
  ref,
  visible,
}: {
  ref: React.Ref<HTMLDivElement>
  visible: boolean
}) {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 transition-opacity duration-700"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {ANNOTATIONS.map((a) => (
        <div
          key={a.id}
          data-anno={a.id}
          className="absolute top-0 left-0"
          style={{ visibility: "hidden" }}
        >
          <div data-line className="absolute h-px bg-[#222]" />
          <div
            data-dot
            className="absolute size-[5px] rounded-full bg-[#222]"
          />
          <div
            data-label
            className="absolute w-[132px] text-[11px] leading-[1.25] tracking-tight text-[#222]"
            style={{ textAlign: a.side === "left" ? "right" : "left" }}
          >
            <span className="font-mono text-[10px] text-[#6b6b6b]">{a.n}</span>{" "}
            {a.label}
            <br />
            <span className="text-[#6b6b6b]">{a.hint}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Dans la scène 3D : à chaque image, projette les points d'ancrage à l'écran et place les légendes.
// S'il n'y a pas la place de chaque côté (téléphone, fenêtre étroite), les légendes sont masquées.
export function Annotator({
  layer,
}: {
  layer: React.RefObject<HTMLDivElement | null>
}) {
  const v = new THREE.Vector3()
  useFrame(({ camera, size }) => {
    const root = layer.current
    if (!root) return
    const toScreen = (x: number, y: number, z: number) => {
      v.set(x, y, z).project(camera)
      return {
        x: (v.x * 0.5 + 0.5) * size.width,
        y: (-v.y * 0.5 + 0.5) * size.height,
      }
    }
    const left = toScreen(EDGE_LEFT, 0, 0).x - GAP
    const right = toScreen(EDGE_RIGHT, 0, 0).x + GAP
    const fits = left - LABEL_W > 8 && right + LABEL_W < size.width - 8
    for (const a of ANNOTATIONS) {
      const el = root.querySelector<HTMLElement>(`[data-anno="${a.id}"]`)
      if (!el) continue
      el.style.visibility = fits ? "visible" : "hidden"
      if (!fits) continue
      const p = toScreen(a.at[0], a.at[1], a.at[2])
      const line = el.querySelector<HTMLElement>("[data-line]")!
      const dot = el.querySelector<HTMLElement>("[data-dot]")!
      const label = el.querySelector<HTMLElement>("[data-label]")!
      const x0 = a.side === "left" ? left : p.x
      const x1 = a.side === "left" ? p.x : right
      line.style.transform = `translate(${x0}px, ${p.y}px)`
      line.style.width = `${Math.max(0, x1 - x0)}px`
      dot.style.transform = `translate(${p.x - 2.5}px, ${p.y - 2.5}px)`
      const lx = a.side === "left" ? left - LABEL_W - 8 : right + 8
      label.style.transform = `translate(${lx}px, ${p.y - 8}px)`
    }
  })
  return null
}
