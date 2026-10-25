"use client"

import { useEffect, useRef, useState } from "react"

const GAP = 16

// Un élément flottant qu'on déplace à la souris ou au doigt.
// Un simple clic (sans déplacement) appelle onClick.
export function useFloating(onClick: () => void) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null)

  function clamp(x: number, y: number) {
    const el = ref.current
    const w = el?.offsetWidth ?? 0
    const h = el?.offsetHeight ?? 0
    return {
      x: Math.min(window.innerWidth - w - GAP, Math.max(GAP, x)),
      y: Math.min(window.innerHeight - h - GAP, Math.max(GAP, y)),
    }
  }

  // reste dans l'écran quand la fenêtre change de taille
  useEffect(() => {
    if (!pos) return
    function onResize() {
      setPos((p) => (p ? clamp(p.x, p.y) : p))
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [pos])

  const handlers = {
    onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
      if (e.button !== 0) return
      // on part de la position réelle (le bloc peut être tourné : on prend son coin visuel)
      const el = ref.current
      const left = el ? el.offsetLeft : 0
      const top = el ? el.offsetTop : 0
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = { dx: e.clientX - left, dy: e.clientY - top, sx: e.clientX, sy: e.clientY, moved: false }
    },
    onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
      const d = drag.current
      if (!d) return
      // suit le curseur tout de suite ; au-delà de 5 px ce n'est plus un clic
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) >= 5) d.moved = true
      setPos(clamp(e.clientX - d.dx, e.clientY - d.dy))
    },
    onPointerUp() {
      const d = drag.current
      drag.current = null
      if (d && !d.moved) onClick()
    },
    onPointerCancel() {
      drag.current = null
    },
    onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        onClick()
      }
    },
  }

  return { ref, pos, handlers }
}
