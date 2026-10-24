"use client"

import { useEffect, useRef, useState } from "react"

import type { Scene } from "@/components/hugtype/scene"
import type { Sheet } from "@/lib/site"

type Card = {
  x: number
  y: number
  rot: number
  scale: number
  opacity: number
  drop: number
  dragX: number
  flying: number // -1 / 1 pendant la sortie, 0 sinon
  prevX: number
  bend: number
  bendV: number
  lift: number
}

// petites inclinaisons fixes pour l'effet « pile de tirages »
const TILTS = [-2.5, 3, -4, 2, -3.5, 4.5]
const VISIBLE = 4

export function SheetStack({
  scene,
  sheets,
  top,
  reducedMotion,
  onOpen,
}: {
  scene: Scene
  sheets: Sheet[]
  // haut de la zone disponible (sous le titre), en px
  top: number
  reducedMotion: boolean
  onOpen: (id: string) => void
}) {
  const [order, setOrder] = useState(() => sheets.map((s) => s.id))
  const orderRef = useRef(order)
  const elRefs = useRef(new Map<string, HTMLDivElement>())
  const cards = useRef(new Map<string, Card>())
  const topRef = useRef(top)
  const gesture = useRef({ id: "", startX: 0, startY: 0, startT: 0, lastX: 0, lastT: 0, vx: 0, moved: false })

  useEffect(() => {
    orderRef.current = order
  }, [order])

  useEffect(() => {
    topRef.current = top
  }, [top])

  useEffect(() => {
    const map = cards.current
    for (const s of sheets) {
      if (!map.has(s.id)) {
        map.set(s.id, { x: 0, y: 0, rot: 0, scale: 1.4, opacity: 0, drop: reducedMotion ? 1 : 0, dragX: 0, flying: 0, prevX: 0, bend: 0, bendV: 0, lift: 0 })
      }
    }
    const byId = new Map(sheets.map((s) => [s.id, s]))
    const t0 = performance.now()
    let raf = 0
    let last = 0

    function frame(now: number) {
      raf = requestAnimationFrame(frame)
      if (now - last < 1000 / 60 - 1) return
      const dt = Math.min(1 / 30, (now - (last || now)) / 1000)
      last = now
      const W = window.innerWidth
      const H = window.innerHeight
      const areaTop = topRef.current
      const cy = areaTop + (H - areaTop) / 2
      const ord = orderRef.current
      const k = (rate: number) => (reducedMotion ? 1 : Math.min(1, dt * rate))
      let moved = false

      ord.forEach((id, depth) => {
        const s = byId.get(id)
        const c = map.get(id)
        const el = elRefs.current.get(id)
        if (!s || !c || !el) return

        const landscape = s.width > s.height
        const maxH = (H - areaTop) * 0.78
        let w = Math.min(W * (landscape ? 0.88 : 0.66), landscape ? 420 : 320)
        if ((w * s.height) / s.width > maxH) w = (maxH * s.width) / s.height
        const h = (w * s.height) / s.width

        // ordre d'arrivée : du bas de la pile vers le haut
        const dropIndex = ord.length - 1 - depth
        let dropScale = 1
        if (c.drop < 1) {
          const p = Math.min(1, Math.max(0, (now - t0 - 250 - dropIndex * 150) / 600))
          c.drop = p
          dropScale = 1 + 0.4 * Math.pow(1 - p, 3)
        }

        const hidden = depth >= VISIBLE
        const tx = W / 2 + (depth === 0 ? c.dragX : 0) + c.flying * W * 1.3
        const ty = cy + Math.min(depth, VISIBLE - 1) * 7
        const trot = TILTS[sheets.indexOf(s) % TILTS.length] * (depth === 0 ? 0.4 : 1) + (depth === 0 ? c.dragX * 0.05 : 0)
        const tscale = (1 - Math.min(depth, VISIBLE - 1) * 0.04) * dropScale
        const topOpacity = c.drop < 1 ? Math.min(1, c.drop * 2.5) : 1
        const topacity = hidden ? 0 : topOpacity

        if (c.x === 0 && c.y === 0) {
          c.x = tx
          c.y = ty
        }
        const dragging = gesture.current.id === id
        const follow = dragging ? 1 : k(c.flying ? 9 : 10)
        c.x += (tx - c.x) * follow
        c.y += (ty - c.y) * k(10)
        c.rot += (trot - c.rot) * k(10)
        c.scale += (tscale - c.scale) * (c.drop < 1 ? 1 : k(10))
        c.opacity += (topacity - c.opacity) * (c.drop < 1 ? 1 : k(8))

        // fin de sortie : la carte repasse sous la pile
        if (c.flying && Math.abs(c.x - tx) < W * 0.25) {
          c.flying = 0
          c.dragX = 0
          setOrder((o) => [...o.filter((x) => x !== id), id])
        }

        // la carte se soulève quand on la tient, et se plie en glissant
        c.lift += ((dragging ? 1 : 0) - c.lift) * k(10)
        const vx = (c.x - c.prevX) / dt
        c.prevX = c.x
        const target = reducedMotion ? 0 : Math.max(-60, Math.min(60, -vx * 0.03))
        c.bendV += (120 * (target - c.bend) - 7 * c.bendV) * dt
        c.bend += c.bendV * dt
        const a = (-c.rot * Math.PI) / 180

        el.style.width = `${w}px`
        el.style.height = `${h}px`
        el.style.transform = `translate3d(${c.x - w / 2}px, ${c.y - h / 2}px, 0) rotate(${c.rot}deg) scale(${c.scale})`
        el.style.zIndex = String(100 - depth)

        if (!hidden && c.opacity > 0.05) {
          scene.sheets.set(id, {
            cx: c.x,
            cy: c.y,
            w,
            h,
            rot: c.rot,
            scale: c.scale,
            z: 100 - depth,
            opacity: c.opacity,
            lift: c.lift,
            bendX: c.bend * Math.cos(a),
            bendY: c.bend * Math.sin(a),
            grabX: 0,
            grabY: 0,
          })
        } else {
          scene.sheets.delete(id)
        }
        moved = true
      })
      if (moved) scene.version++
    }

    raf = requestAnimationFrame(frame)
    function onVisibility() {
      cancelAnimationFrame(raf)
      if (!document.hidden) {
        last = 0
        raf = requestAnimationFrame(frame)
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    const sheetMap = scene.sheets
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener("visibilitychange", onVisibility)
      for (const s of sheets) sheetMap.delete(s.id)
      scene.version++
    }
  }, [scene, sheets, reducedMotion])

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>, id: string) {
    if (orderRef.current[0] !== id) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const now = e.timeStamp
    gesture.current = { id, startX: e.clientX, startY: e.clientY, startT: now, lastX: e.clientX, lastT: now, vx: 0, moved: false }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current
    const c = cards.current.get(g.id)
    if (!g.id || !c) return
    const now = e.timeStamp
    g.vx = g.vx * 0.6 + ((e.clientX - g.lastX) / Math.max(1, now - g.lastT)) * 1000 * 0.4
    g.lastX = e.clientX
    g.lastT = now
    if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > 8) g.moved = true
    c.dragX = e.clientX - g.startX
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current
    const c = cards.current.get(g.id)
    const id = g.id
    gesture.current = { ...g, id: "" }
    if (!id || !c) return
    if (!g.moved && e.timeStamp - g.startT < 400) {
      c.dragX = 0
      onOpen(id)
      return
    }
    if (Math.abs(c.dragX) > 90 || Math.abs(g.vx) > 600) {
      c.flying = Math.sign(c.dragX || g.vx)
    } else {
      c.dragX = 0
    }
  }

  return (
    <div className="absolute inset-0 isolate z-10 overflow-hidden">
      {order.map((id, depth) => {
        const s = sheets.find((x) => x.id === id)
        if (!s) return null
        return (
          <div
            key={id}
            ref={(el) => {
              if (el) elRefs.current.set(id, el)
              else elRefs.current.delete(id)
            }}
            role="button"
            tabIndex={depth === 0 ? 0 : -1}
            aria-label={`Open ${s.title}`}
            onPointerDown={(e) => onPointerDown(e, id)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onOpen(id)
              }
            }}
            className="absolute top-0 left-0 touch-none outline-none select-none focus-visible:ring-2 focus-visible:ring-white"
          />
        )
      })}
    </div>
  )
}
