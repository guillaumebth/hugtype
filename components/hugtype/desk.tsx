"use client"

import { gsap } from "gsap"
import { useEffect, useRef } from "react"

import type { Scene } from "@/components/hugtype/scene"
import type { Sheet } from "@/lib/site"

type Body = {
  x: number
  y: number
  w: number
  h: number
  rot: number
  restRot: number
  scale: number
  lift: number
  opacity: number
  z: number
  // pliure : ressort amorti, nourri par la vitesse
  bendX: number
  bendY: number
  bendVX: number
  bendVY: number
  prevX: number
  prevY: number
  grabX: number
  grabY: number
  dragging: boolean
  offX: number
  offY: number
  vx: number
  vy: number
  lastX: number
  lastY: number
  lastT: number
  downX: number
  downY: number
  downT: number
  xTo: ((v: number) => void) | null
  yTo: ((v: number) => void) | null
}

const DESIGN_W = 1440
const DESIGN_H = 937
const BEND_MAX = 70

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

export function Desk({
  scene,
  sheets,
  reducedMotion,
  tidySignal,
  onOpen,
}: {
  scene: Scene
  sheets: Sheet[]
  reducedMotion: boolean
  tidySignal: number
  onOpen: (id: string) => void
}) {
  const elRefs = useRef(new Map<string, HTMLDivElement>())
  const bodies = useRef(new Map<string, Body>())
  const topZ = useRef(sheets.length)
  const size = useRef({ w: 0, h: 0 })

  useEffect(() => {
    const map = bodies.current
    const W = window.innerWidth
    const H = window.innerHeight
    size.current = { w: W, h: H }
    const unit = Math.min(1.25, Math.max(0.55, W / DESIGN_W))

    sheets.forEach((s, i) => {
      const w = s.desk.w * unit
      const rot = s.desk.rot + rand(-2.5, 2.5)
      const x = (s.desk.x / DESIGN_W) * W
      const y = (s.desk.y / DESIGN_H) * H
      const b: Body = {
        x,
        y,
        w,
        h: (w * s.height) / s.width,
        rot,
        restRot: rot,
        scale: 1,
        lift: 0,
        opacity: 1,
        z: i + 1,
        bendX: 0,
        bendY: 0,
        bendVX: 0,
        bendVY: 0,
        prevX: x,
        prevY: y,
        grabX: 0,
        grabY: 0,
        dragging: false,
        offX: 0,
        offY: 0,
        vx: 0,
        vy: 0,
        lastX: 0,
        lastY: 0,
        lastT: 0,
        downX: 0,
        downY: 0,
        downT: 0,
        xTo: null,
        yTo: null,
      }
      map.set(s.id, b)

      const el = elRefs.current.get(s.id)
      if (el) {
        el.style.width = `${b.w}px`
        el.style.height = `${b.h}px`
      }

      if (!reducedMotion) {
        // arrivée : la feuille tombe du dessus, flotte un peu puis se pose
        const delay = 0.25 + i * 0.16
        gsap.fromTo(
          b,
          { y: y - 70, rot: rot - rand(8, 14), scale: 1.25, lift: 1, opacity: 0 },
          { y, rot, scale: 1, lift: 0, duration: 1.1, delay, ease: "power3.out" }
        )
        gsap.to(b, { opacity: 1, duration: 0.35, delay, ease: "none" })
        // petit souffle d'air sous la feuille à l'atterrissage
        gsap.delayedCall(delay + 0.45, () => {
          b.bendVY -= rand(500, 800)
          b.bendVX += rand(-300, 300)
        })
      }
    })

    function tick(_time: number, deltaMs: number) {
      const dt = Math.min(1 / 30, deltaMs / 1000) || 1 / 60
      const { w: W, h: H } = size.current
      let moved = false

      for (const s of sheets) {
        const b = map.get(s.id)
        const el = elRefs.current.get(s.id)
        if (!b || !el) continue

        // vitesse réelle de la feuille (glisser, élan, rangement…)
        const vx = (b.x - b.prevX) / dt
        const vy = (b.y - b.prevY) / dt
        if (b.x !== b.prevX || b.y !== b.prevY) moved = true
        b.prevX = b.x
        b.prevY = b.y

        // dans le repère de la feuille, la pliure part vers l'arrière du mouvement
        const a = (-b.rot * Math.PI) / 180
        const lx = vx * Math.cos(a) - vy * Math.sin(a)
        const ly = vx * Math.sin(a) + vy * Math.cos(a)
        const strength = reducedMotion ? 0 : 0.035 * (0.4 + b.lift * 0.6)
        const tx = Math.max(-BEND_MAX, Math.min(BEND_MAX, -lx * strength))
        const ty = Math.max(-BEND_MAX, Math.min(BEND_MAX, -ly * strength))
        // ressort peu amorti : la feuille ondule un peu avant de se calmer
        b.bendVX += (120 * (tx - b.bendX) - 7 * b.bendVX) * dt
        b.bendVY += (120 * (ty - b.bendY) - 7 * b.bendVY) * dt
        b.bendX += b.bendVX * dt
        b.bendY += b.bendVY * dt
        if (Math.abs(b.bendX) + Math.abs(b.bendY) > 0.05) moved = true

        // le centre reste à l'écran pour qu'on puisse toujours la rattraper
        if (!b.dragging) {
          b.x = Math.min(W, Math.max(0, b.x))
          b.y = Math.min(H, Math.max(0, b.y))
        }

        el.style.transform = `translate3d(${b.x - b.w / 2}px, ${b.y - b.h / 2}px, 0) rotate(${b.rot}deg) scale(${b.scale})`
        el.style.zIndex = String(b.z)

        scene.sheets.set(s.id, {
          cx: b.x,
          cy: b.y,
          w: b.w,
          h: b.h,
          rot: b.rot,
          scale: b.scale,
          z: b.z,
          opacity: b.opacity,
          lift: b.lift,
          bendX: b.bendX,
          bendY: b.bendY,
          grabX: b.grabX,
          grabY: b.grabY,
        })
      }
      if (moved) scene.version++
    }

    function onResize() {
      const W = window.innerWidth
      const H = window.innerHeight
      const fx = W / size.current.w
      const fy = H / size.current.h
      const unit = Math.min(1.25, Math.max(0.55, W / DESIGN_W))
      for (const s of sheets) {
        const b = map.get(s.id)
        if (!b) continue
        b.x *= fx
        b.y *= fy
        b.prevX = b.x
        b.prevY = b.y
        b.w = s.desk.w * unit
        b.h = (b.w * s.height) / s.width
        const el = elRefs.current.get(s.id)
        if (el) {
          el.style.width = `${b.w}px`
          el.style.height = `${b.h}px`
        }
      }
      size.current = { w: W, h: H }
      scene.version++
    }

    gsap.ticker.fps(60)
    gsap.ticker.add(tick)
    window.addEventListener("resize", onResize)
    const sheetMap = scene.sheets
    return () => {
      gsap.ticker.remove(tick)
      window.removeEventListener("resize", onResize)
      for (const b of map.values()) gsap.killTweensOf(b)
      for (const s of sheets) sheetMap.delete(s.id)
      scene.version++
    }
  }, [scene, sheets, reducedMotion])

  // « TIDY UP » : une rangée bien alignée, les feuilles se soulèvent en passant
  useEffect(() => {
    if (tidySignal === 0) return
    const { w: W, h: H } = size.current
    const list = sheets.map((s) => bodies.current.get(s.id)).filter((b): b is Body => !!b)
    const total = list.reduce((sum, b) => sum + b.w, 0)
    const margin = Math.min(80, W * 0.05)
    const avail = W - margin * 2
    const gap =
      total > avail
        ? -(total - avail) / (list.length - 1)
        : Math.min(40, (avail - total) / (list.length - 1))
    let x = (W - (total + gap * (list.length - 1))) / 2
    const y = Math.max(H * 0.66, H - Math.max(...list.map((b) => b.h)) / 2 - 40)
    list.forEach((b, i) => {
      gsap.killTweensOf(b)
      b.restRot = rand(-1.2, 1.2)
      b.z = ++topZ.current
      const duration = reducedMotion ? 0 : 1
      const delay = reducedMotion ? 0 : i * 0.06
      gsap.to(b, { x: x + b.w / 2, y, rot: b.restRot, scale: 1, duration, delay, ease: "power3.inOut" })
      if (!reducedMotion) {
        gsap.to(b, { keyframes: { lift: [0, 0.7, 0], ease: "sine.inOut" }, duration, delay })
      }
      x += b.w + gap
    })
  }, [tidySignal, sheets, reducedMotion])

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>, id: string) {
    if (e.button !== 0) return
    const b = bodies.current.get(id)
    if (!b) return
    e.currentTarget.setPointerCapture(e.pointerId)
    gsap.killTweensOf(b)
    b.dragging = true
    b.z = ++topZ.current
    b.offX = e.clientX - b.x
    b.offY = e.clientY - b.y
    b.vx = 0
    b.vy = 0
    b.lastX = e.clientX
    b.lastY = e.clientY
    b.lastT = e.timeStamp
    b.downX = e.clientX
    b.downY = e.clientY
    b.downT = e.timeStamp
    // point attrapé, dans le repère de la feuille (pour la bosse du papier)
    const a = (-b.rot * Math.PI) / 180
    const lx = b.offX * Math.cos(a) - b.offY * Math.sin(a)
    const ly = b.offX * Math.sin(a) + b.offY * Math.cos(a)
    b.grabX = Math.max(-0.5, Math.min(0.5, lx / b.w))
    b.grabY = Math.max(-0.5, Math.min(0.5, ly / b.h))
    // suivi souple du doigt / de la souris
    b.xTo = gsap.quickTo(b, "x", { duration: reducedMotion ? 0 : 0.22, ease: "power3" })
    b.yTo = gsap.quickTo(b, "y", { duration: reducedMotion ? 0 : 0.22, ease: "power3" })
    gsap.to(b, { lift: 1, scale: 1.03, rot: 0, duration: reducedMotion ? 0 : 0.45, ease: "power2.out" })
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>, id: string) {
    const b = bodies.current.get(id)
    if (!b?.dragging) return
    const dt = Math.max(1, e.timeStamp - b.lastT) / 1000
    b.vx = b.vx * 0.6 + ((e.clientX - b.lastX) / dt) * 0.4
    b.vy = b.vy * 0.6 + ((e.clientY - b.lastY) / dt) * 0.4
    b.lastX = e.clientX
    b.lastY = e.clientY
    b.lastT = e.timeStamp
    b.xTo?.(e.clientX - b.offX)
    b.yTo?.(e.clientY - b.offY)
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>, id: string) {
    const b = bodies.current.get(id)
    if (!b?.dragging) return
    b.dragging = false
    gsap.killTweensOf(b)
    b.xTo = null
    b.yTo = null
    // un simple clic (sans glisser) ouvre la feuille en grand
    const isClick =
      e.type === "pointerup" &&
      Math.hypot(e.clientX - b.downX, e.clientY - b.downY) < 6 &&
      e.timeStamp - b.downT < 350
    if (isClick) {
      gsap.to(b, { lift: 0, scale: 1, rot: b.restRot, duration: reducedMotion ? 0 : 0.5, ease: "power2.out" })
      onOpen(id)
      return
    }
    // si la main s'est arrêtée avant de lâcher, pas d'élan
    if (e.timeStamp - b.lastT > 80) {
      b.vx = 0
      b.vy = 0
    }
    const speed = Math.hypot(b.vx, b.vy)
    const max = 2200
    const k = speed > max ? max / speed : 1
    const { w: W, h: H } = size.current
    // elle glisse encore un peu, puis se pose avec une petite inclinaison
    const tx = Math.min(W, Math.max(0, e.clientX - b.offX + b.vx * k * 0.2))
    const ty = Math.min(H, Math.max(0, e.clientY - b.offY + b.vy * k * 0.2))
    b.restRot = rand(-5, 5)
    const d = reducedMotion ? 0 : 1
    gsap.to(b, { x: tx, y: ty, duration: 0.9 * d, ease: "power3.out" })
    gsap.to(b, { rot: b.restRot, duration: 1.1 * d, ease: "back.out(1.6)" })
    gsap.to(b, { lift: 0, scale: 1, duration: 0.8 * d, ease: "power2.inOut" })
  }

  // Calque invisible : il reçoit la souris et le clavier, le rendu est fait en WebGL
  return (
    <div className="absolute inset-0 isolate z-10 overflow-hidden">
      {sheets.map((s) => (
        <div
          key={s.id}
          ref={(el) => {
            if (el) elRefs.current.set(s.id, el)
            else elRefs.current.delete(s.id)
          }}
          role="button"
          tabIndex={0}
          aria-label={`Open ${s.title}`}
          onPointerDown={(e) => onPointerDown(e, s.id)}
          onPointerMove={(e) => onPointerMove(e, s.id)}
          onPointerUp={(e) => onPointerUp(e, s.id)}
          onPointerCancel={(e) => onPointerUp(e, s.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onOpen(s.id)
            }
          }}
          className="absolute top-0 left-0 cursor-grab touch-none outline-none select-none focus-visible:ring-2 focus-visible:ring-white active:cursor-grabbing"
          style={{ transformOrigin: "center" }}
        />
      ))}
    </div>
  )
}
