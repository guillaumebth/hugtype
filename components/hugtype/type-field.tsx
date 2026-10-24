"use client"

import { useEffect, useRef } from "react"

import { boxCorners, type Scene } from "@/components/hugtype/scene"

const TEXT =
  "HUGTYPE WRAPS TEXT AROUND, INSIDE OR ALONG ANY CUTOUT IMAGE. LIVE PREVIEW. NATIVE, EDITABLE FIGMA TEXT. FREE FOR FIGMA COMMUNITY. "

const GREY = [255, 255, 255, 0.18] as const
const LIT = [255, 255, 255, 0.95] as const

const RADIUS = 120
const SHEET_PAD = 10
const BLOCK_PAD = 6
const FRAME_MS = 1000 / 60
const IDLE_MS = 2500

type Segment = { x: number; y: number; start: number; text: string }
type Particle = { dx: number; dy: number; vx: number; vy: number; tx: number; ty: number; heat: number }

// Intervalle horizontal couvert par un polygone convexe sur une bande [y0, y1]
function polyInterval(pts: readonly (readonly [number, number])[], y0: number, y1: number) {
  let min = Infinity
  let max = -Infinity
  const lines = [y0, (y0 + y1) / 2, y1]
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i]
    const [bx, by] = pts[(i + 1) % pts.length]
    if (ay >= y0 && ay <= y1) {
      min = Math.min(min, ax)
      max = Math.max(max, ax)
    }
    for (const y of lines) {
      if ((y - ay) * (y - by) <= 0 && ay !== by) {
        const x = ax + ((y - ay) / (by - ay)) * (bx - ax)
        min = Math.min(min, x)
        max = Math.max(max, x)
      }
    }
  }
  return min <= max ? ([min, max] as const) : null
}

export function TypeField({
  scene,
  fontFamily,
  reducedMotion,
}: {
  scene: Scene
  fontFamily: string
  reducedMotion: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    let W = 0
    let H = 0
    let fontSize = 11
    let lineH = 16
    let charW = 6.6
    let segments: Segment[] = []
    let layoutVersion = -1
    let big = TEXT
    const particles = new Map<number, Particle>()

    const pointer = { x: 0, y: 0, active: false, last: -Infinity }
    const cursor = { x: -9999, y: -9999 }
    let raf = 0
    let lastFrame = 0
    let lastTick = 0
    let running = false
    let fontsReady = false

    function resize() {
      if (!canvas || !ctx) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      canvas.style.width = `${W}px`
      canvas.style.height = `${H}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      fontSize = W < 768 ? 10 : 11
      lineH = Math.round(fontSize * 1.45)
      ctx.font = `500 ${fontSize}px ${fontFamily}`
      ctx.textBaseline = "alphabetic"
      charW = ctx.measureText("MMMMMMMMMM").width / 10
      const need = Math.ceil(W / charW) + TEXT.length
      big = TEXT.repeat(Math.ceil(need / TEXT.length) + 1)
      layoutVersion = -1
    }

    // Recalcule les lignes de texte en contournant les feuilles et le titre
    function layout() {
      const polys = [...scene.sheets.values()].map((b) => boxCorners(b, SHEET_PAD))
      const rects = scene.blocks
      const rows = Math.ceil(H / lineH) + 1
      const out: Segment[] = []
      let stream = 0
      const blocked: [number, number][] = []
      for (let r = 0; r < rows; r++) {
        const y0 = r * lineH
        const y1 = y0 + lineH
        blocked.length = 0
        for (const p of polys) {
          const iv = polyInterval(p, y0, y1)
          if (iv) blocked.push([iv[0], iv[1]])
        }
        for (const b of rects) {
          if (b.y - BLOCK_PAD < y1 && b.y + b.h + BLOCK_PAD > y0) {
            blocked.push([b.x - BLOCK_PAD, b.x + b.w + BLOCK_PAD])
          }
        }
        blocked.sort((a, b) => a[0] - b[0])
        let x = 0
        const spans: [number, number][] = []
        for (const [a, b] of blocked) {
          if (a > x) spans.push([x, a])
          x = Math.max(x, b)
        }
        if (x < W) spans.push([x, W])
        for (const [a, b] of spans) {
          const count = Math.floor((b - a) / charW)
          if (count < 2) continue
          const from = stream % TEXT.length
          out.push({ x: a, y: y0 + fontSize, start: stream, text: big.slice(from, from + count) })
          stream += count
        }
      }
      segments = out
      layoutVersion = scene.version
    }

    function segmentIndex(i: number) {
      let lo = 0
      let hi = segments.length - 1
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (segments[mid].start <= i) lo = mid
        else hi = mid - 1
      }
      return lo
    }

    function step(dt: number, now: number) {
      const idle = !pointer.active || now - pointer.last > IDLE_MS
      let tx = pointer.x
      let ty = pointer.y
      if (idle) {
        // cercle invisible qui dérive lentement
        const t = now / 1000
        tx = W / 2 + W * 0.36 * Math.sin(t * 0.17)
        ty = H / 2 + H * 0.32 * Math.sin(t * 0.23 + 1.3)
      }
      const follow = idle ? 1.6 : 14
      if (cursor.x < -1000) {
        cursor.x = tx
        cursor.y = ty
      }
      cursor.x += (tx - cursor.x) * Math.min(1, dt * follow)
      cursor.y += (ty - cursor.y) * Math.min(1, dt * follow)

      for (const p of particles.values()) {
        p.tx = 0
        p.ty = 0
      }

      // lettres dans le rayon : on leur donne une cible écartée du curseur
      const r0 = Math.max(0, Math.floor((cursor.y - RADIUS) / lineH))
      const r1 = Math.ceil((cursor.y + RADIUS) / lineH)
      if (segments.length) {
        for (const seg of segments) {
          const row = Math.round((seg.y - fontSize) / lineH)
          if (row < r0 || row > r1) continue
          const cy = seg.y - fontSize * 0.35
          const k0 = Math.max(0, Math.floor((cursor.x - RADIUS - seg.x) / charW))
          const k1 = Math.min(seg.text.length - 1, Math.ceil((cursor.x + RADIUS - seg.x) / charW))
          for (let k = k0; k <= k1; k++) {
            const cx = seg.x + k * charW + charW / 2
            const ddx = cx - cursor.x
            const ddy = cy - cursor.y
            const d = Math.hypot(ddx, ddy)
            if (d >= RADIUS || d < 0.001) continue
            const f = 1 - d / RADIUS
            // poussée forte au centre, qui s'étale jusqu'au bord du rayon
            const push = Math.pow(f, 1.15) * RADIUS * 0.95
            const i = seg.start + k
            let p = particles.get(i)
            if (!p) {
              p = { dx: 0, dy: 0, vx: 0, vy: 0, tx: 0, ty: 0, heat: 0 }
              particles.set(i, p)
            }
            p.tx = (ddx / d) * push
            p.ty = (ddy / d) * push
            p.heat = Math.max(p.heat, Math.min(1, f * 1.6))
          }
        }
      }

      // ressort amorti vers la cible, puis retour au repos
      for (const [i, p] of particles) {
        const ax = 190 * (p.tx - p.dx) - 12 * p.vx
        const ay = 190 * (p.ty - p.dy) - 12 * p.vy
        p.vx += ax * dt
        p.vy += ay * dt
        p.dx += p.vx * dt
        p.dy += p.vy * dt
        p.heat = Math.max(0, p.heat - dt * 1.1)
        if (
          p.tx === 0 &&
          p.ty === 0 &&
          p.heat === 0 &&
          Math.abs(p.dx) + Math.abs(p.dy) < 0.05 &&
          Math.abs(p.vx) + Math.abs(p.vy) < 0.05
        ) {
          particles.delete(i)
        }
      }
    }

    function colorFor(heat: number) {
      const t = Math.min(1, heat)
      const r = Math.round(GREY[0] + (LIT[0] - GREY[0]) * t)
      const g = Math.round(GREY[1] + (LIT[1] - GREY[1]) * t)
      const b = Math.round(GREY[2] + (LIT[2] - GREY[2]) * t)
      const a = GREY[3] + (LIT[3] - GREY[3]) * t
      return `rgba(${r},${g},${b},${a.toFixed(3)})`
    }

    function draw() {
      if (!ctx) return
      ctx.clearRect(0, 0, W, H)
      ctx.font = `500 ${fontSize}px ${fontFamily}`
      const grey = `rgba(${GREY[0]},${GREY[1]},${GREY[2]},${GREY[3]})`

      const busy = new Set<number>()
      for (const i of particles.keys()) busy.add(segmentIndex(i))

      ctx.fillStyle = grey
      for (let s = 0; s < segments.length; s++) {
        const seg = segments[s]
        if (!busy.has(s)) {
          ctx.fillText(seg.text, seg.x, seg.y)
          continue
        }
        for (let k = 0; k < seg.text.length; k++) {
          if (particles.has(seg.start + k)) continue
          ctx.fillText(seg.text[k], seg.x + k * charW, seg.y)
        }
      }

      for (const [i, p] of particles) {
        const seg = segments[segmentIndex(i)]
        const k = i - seg.start
        if (k < 0 || k >= seg.text.length) continue
        ctx.fillStyle = colorFor(p.heat)
        ctx.fillText(seg.text[k], seg.x + k * charW + p.dx, seg.y + p.dy)
      }
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame)
      if (now - lastFrame < FRAME_MS - 1) return
      const dt = Math.min(1 / 30, (now - (lastTick || now)) / 1000)
      lastFrame = now
      lastTick = now
      if (!fontsReady) return

      const changed = layoutVersion !== scene.version
      if (changed) {
        layout()
        // les index changent avec la mise en page : on repart de zéro
        if (reducedMotion) particles.clear()
      }
      if (reducedMotion) {
        if (changed) draw()
        return
      }
      step(dt, now)
      draw()
    }

    function start() {
      if (running) return
      running = true
      lastTick = 0
      raf = requestAnimationFrame(frame)
    }

    function stop() {
      running = false
      cancelAnimationFrame(raf)
    }

    function onVisibility() {
      if (document.hidden) stop()
      else start()
    }

    function onPointer(e: PointerEvent) {
      pointer.x = e.clientX
      pointer.y = e.clientY
      pointer.active = true
      pointer.last = performance.now()
    }

    function onLeave() {
      pointer.active = false
    }

    function onResize() {
      resize()
      if (reducedMotion) draw()
    }

    resize()
    document.fonts.ready.then(() => {
      fontsReady = true
      resize()
    })

    window.addEventListener("resize", onResize)
    window.addEventListener("pointermove", onPointer, { passive: true })
    window.addEventListener("pointerdown", onPointer, { passive: true })
    window.addEventListener("pointerup", onPointer, { passive: true })
    document.documentElement.addEventListener("pointerleave", onLeave)
    document.addEventListener("visibilitychange", onVisibility)
    if (!document.hidden) start()

    return () => {
      stop()
      window.removeEventListener("resize", onResize)
      window.removeEventListener("pointermove", onPointer)
      window.removeEventListener("pointerdown", onPointer)
      window.removeEventListener("pointerup", onPointer)
      document.documentElement.removeEventListener("pointerleave", onLeave)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [scene, fontFamily, reducedMotion])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 block"
    />
  )
}
