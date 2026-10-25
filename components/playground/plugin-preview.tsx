"use client"

import { useEffect, useRef } from "react"

import type { Mask } from "@/lib/hugtype/engine"
import type { Composition, FontChoice, Metrics, Rect } from "@/lib/hugtype/playground"
import { drawPreview, fitView, type HitKind, type View } from "@/lib/hugtype/preview"

export type ZoomApi = { zoomIn: () => void; zoomOut: () => void; fit: () => void }

type Drag =
  | { kind: "pan"; sx: number; sy: number; ox: number; oy: number }
  | { kind: HitKind; start: { x: number; y: number }; orig: Rect }

const CURSORS: Record<HitKind, string> = {
  obj: "grab",
  text: "grab",
  right: "ew-resize",
  bottom: "ns-resize",
  corner: "nwse-resize",
}

// Interactions reprises de ui.html : glisser l'objet ou le texte, tirer les poignées,
// zoom (Ctrl/Cmd + molette, boutons), molette pour se déplacer, double-clic pour recadrer
export function PluginPreview({
  mask,
  col,
  mode,
  metrics,
  comp,
  font,
  result,
  hint,
  onObj,
  onCol,
  onZoom,
  zoomRef,
}: {
  mask: Mask
  col: Rect
  mode: "around" | "inside" | "outline"
  metrics: Metrics
  comp: Composition
  font: FontChoice
  result: CanvasImageSource | null
  hint: boolean
  onObj: (r: Rect) => void
  onCol: (r: Rect, fixedH: boolean) => void
  onZoom: (pct: number) => void
  zoomRef: React.RefObject<ZoomApi | null>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const view = useRef<View & { fitS: number; user: boolean }>({ s: 1, ox: 0, oy: 0, fitS: 1, user: false })
  const hover = useRef<HitKind | null>(null)
  const drag = useRef<Drag | null>(null)
  const spaceDown = useRef(false)
  const lastMode = useRef(mode)
  const fitted = useRef(false)
  const props = useRef({ mask, col, mode, metrics, comp, font, result, hint, onObj, onCol, onZoom })

  useEffect(() => {
    props.current = { mask, col, mode, metrics, comp, font, result, hint, onObj, onCol, onZoom }
    // premier affichage et changement de mode : on recadre, comme dans le plugin
    if (!fitted.current || lastMode.current !== mode) {
      fitted.current = true
      lastMode.current = mode
      fit(true)
    }
    draw()
  })

  function size() {
    const r = canvasRef.current?.getBoundingClientRect()
    return { w: r?.width ?? 1, h: r?.height ?? 1 }
  }

  function fit(force: boolean) {
    if (view.current.user && !force) return
    const { w, h } = size()
    const p = props.current
    const v = fitView(w, h, p)
    view.current = { ...v, fitS: v.s, user: false }
    p.onZoom(100)
  }

  function draw() {
    const cv = canvasRef.current
    const ctx = cv?.getContext("2d")
    if (!cv || !ctx) return
    const { w, h } = size()
    const dpr = window.devicePixelRatio || 1
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const p = props.current
    const d = drag.current
    drawPreview(ctx, w, h, {
      view: view.current,
      mask: p.mask,
      col: p.col,
      mode: p.mode,
      metrics: p.metrics,
      comp: p.comp,
      font: p.font,
      hover: hover.current,
      drag: d && d.kind !== "pan" ? d.kind : null,
      result: p.result,
      hint: p.hint,
    })
  }

  function zoomAt(factor: number, sx: number, sy: number) {
    const v = view.current
    const s = Math.min(v.fitS * 24, Math.max(v.fitS * 0.25, v.s * factor))
    v.ox = sx - (sx - v.ox) * (s / v.s)
    v.oy = sy - (sy - v.oy) * (s / v.s)
    v.s = s
    v.user = true
    props.current.onZoom(Math.round((s / v.fitS) * 100))
    draw()
  }

  function colRect() {
    const v = view.current
    const c = props.current.col
    return { x: v.ox + c.x * v.s, y: v.oy + c.y * v.s, w: c.w * v.s, h: c.h * v.s }
  }

  function toWorld(e: { clientX: number; clientY: number }) {
    const r = canvasRef.current?.getBoundingClientRect()
    const v = view.current
    const sx = e.clientX - (r?.left ?? 0)
    const sy = e.clientY - (r?.top ?? 0)
    return { x: (sx - v.ox) / v.s, y: (sy - v.oy) / v.s, sx, sy }
  }

  // hit() de ui.html (zones un peu plus larges au doigt)
  function hit(p: { x: number; y: number; sx: number; sy: number }, touch: boolean): HitKind | null {
    const st = props.current
    if (st.mode === "around") {
      const c = colRect()
      const t = touch ? 14 : 7
      const nearR = Math.abs(p.sx - (c.x + c.w)) < t
      const nearB = Math.abs(p.sy - (c.y + c.h)) < t
      const inX = p.sx > c.x - t && p.sx < c.x + c.w + t
      const inY = p.sy > c.y - t && p.sy < c.y + c.h + t
      if (nearR && nearB) return "corner"
      if (nearR && inY) return "right"
      if (nearB && inX) return "bottom"
    }
    const m = st.mask
    const tol = (touch ? 10 : 4) / view.current.s
    if (p.x >= m.x - tol && p.x <= m.x + m.w + tol && p.y >= m.y - tol && p.y <= m.y + m.h + tol) {
      const row = Math.min(m.ih - 1, Math.max(0, Math.floor(((p.y - m.y) * m.ih) / m.h)))
      const sx = m.iw / m.w
      if (m.left[row] >= 0 && p.x >= m.x + m.left[row] / sx - tol && p.x <= m.x + (m.right[row] + 1) / sx + tol)
        return "obj"
    }
    const c = st.col
    if (st.mode === "around" && p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) return "text"
    return null
  }

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    zoomRef.current = {
      zoomIn: () => zoomAt(1.5, size().w / 2, size().h / 2),
      zoomOut: () => zoomAt(1 / 1.5, size().w / 2, size().h / 2),
      fit: () => {
        fit(true)
        draw()
      },
    }

    function onDown(e: PointerEvent) {
      const p = toWorld(e)
      const h = spaceDown.current || e.button === 1 ? null : hit(p, e.pointerType !== "mouse")
      if (!h) {
        const v = view.current
        drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, ox: v.ox, oy: v.oy }
        cv?.setPointerCapture(e.pointerId)
        if (cv) cv.style.cursor = "grabbing"
        return
      }
      const st = props.current
      const orig = h === "obj" ? { x: st.mask.x, y: st.mask.y, w: st.mask.w, h: st.mask.h } : { ...st.col }
      drag.current = { kind: h, start: { x: p.x, y: p.y }, orig }
      cv?.setPointerCapture(e.pointerId)
      if (cv && (h === "obj" || h === "text")) cv.style.cursor = "grabbing"
      draw()
    }

    function onMove(e: PointerEvent) {
      const p = toWorld(e)
      const d = drag.current
      const st = props.current
      if (d && d.kind === "pan") {
        view.current.ox = d.ox + e.clientX - d.sx
        view.current.oy = d.oy + e.clientY - d.sy
        if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 2) view.current.user = true
        draw()
        return
      }
      if (d) {
        let dx = p.x - d.start.x
        let dy = p.y - d.start.y
        if (d.kind === "obj" || d.kind === "text") {
          if (e.shiftKey) {
            if (Math.abs(dx) > Math.abs(dy)) dy = 0
            else dx = 0
          }
          const next = { ...d.orig, x: d.orig.x + dx, y: d.orig.y + dy }
          if (d.kind === "obj") st.onObj(next)
          else st.onCol(next, false)
        } else {
          const minW = st.metrics.fontSize * 3
          const w = d.kind !== "bottom" ? Math.max(minW, d.orig.w + dx) : d.orig.w
          const h = d.kind !== "right" ? Math.max(st.metrics.lh, d.orig.h + dy) : d.orig.h
          st.onCol({ ...d.orig, w, h }, d.kind !== "right")
        }
        return
      }
      if (e.pointerType !== "mouse") return
      const h = hit(p, false)
      if (h !== hover.current) {
        hover.current = h
        draw()
      }
      if (cv) cv.style.cursor = spaceDown.current ? "grab" : h ? CURSORS[h] : view.current.user ? "grab" : "default"
    }

    function onUp() {
      const d = drag.current
      if (!d) return
      drag.current = null
      if (cv) cv.style.cursor = "default"
      if (d.kind !== "pan") fit(false)
      draw()
    }

    function onLeave() {
      if (!drag.current && hover.current) {
        hover.current = null
        draw()
      }
    }

    function onWheel(e: WheelEvent) {
      const r = cv?.getBoundingClientRect()
      if (!r) return
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.min(2, Math.max(0.5, Math.exp(-e.deltaY * 0.01))), e.clientX - r.left, e.clientY - r.top)
      } else {
        view.current.ox -= e.deltaX
        view.current.oy -= e.deltaY
        view.current.user = true
        draw()
      }
    }

    function onDbl() {
      fit(true)
      draw()
    }

    function onKey(e: KeyboardEvent) {
      const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement as HTMLElement | null)?.tagName ?? "")
      if (e.code !== "Space" || typing) return
      if (e.type === "keydown" && !spaceDown.current) {
        spaceDown.current = true
        if (cv) cv.style.cursor = "grab"
        e.preventDefault()
      } else if (e.type === "keyup") {
        spaceDown.current = false
        if (cv) cv.style.cursor = "default"
      }
    }

    const ro = new ResizeObserver(() => {
      fit(false)
      draw()
    })
    ro.observe(cv)
    cv.addEventListener("pointerdown", onDown)
    cv.addEventListener("pointermove", onMove)
    cv.addEventListener("pointerup", onUp)
    cv.addEventListener("pointercancel", onUp)
    cv.addEventListener("pointerleave", onLeave)
    cv.addEventListener("wheel", onWheel, { passive: false })
    cv.addEventListener("dblclick", onDbl)
    window.addEventListener("keydown", onKey)
    window.addEventListener("keyup", onKey)
    document.fonts.ready.then(() => draw())
    return () => {
      ro.disconnect()
      cv.removeEventListener("pointerdown", onDown)
      cv.removeEventListener("pointermove", onMove)
      cv.removeEventListener("pointerup", onUp)
      cv.removeEventListener("pointercancel", onUp)
      cv.removeEventListener("pointerleave", onLeave)
      cv.removeEventListener("wheel", onWheel)
      cv.removeEventListener("dblclick", onDbl)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("keyup", onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-label="Preview. Drag the object, or pull the frame handles."
      className="block size-full touch-none"
    />
  )
}
