// Les interactions de l'aperçu (reprises de ui.html), sans dépendre du DOM :
// glisser l'objet ou le texte, tirer les poignées, zoom, déplacement, recadrage.
// Utilisé par le panneau à plat (canvas HTML) et par les écrans de l'objet 3D (texture).

import type { Mask } from "@/lib/hugtype/engine"
import type {
  Composition,
  FontChoice,
  Metrics,
  Rect,
} from "@/lib/hugtype/playground"
import {
  drawPreview,
  fitView,
  type HitKind,
  type View,
} from "@/lib/hugtype/preview"

export type ZoomApi = {
  zoomIn: () => void
  zoomOut: () => void
  fit: () => void
}

export type PreviewProps = {
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
}

// Un point dans le repère de l'aperçu (en px, origine en haut à gauche)
export type PreviewPointer = {
  sx: number
  sy: number
  touch: boolean
  pan?: boolean
  shiftKey?: boolean
}

type Drag =
  | { kind: "pan"; sx: number; sy: number; ox: number; oy: number }
  | { kind: HitKind; start: { x: number; y: number }; orig: Rect }

export const PREVIEW_CURSORS: Record<HitKind, string> = {
  obj: "grab",
  text: "grab",
  right: "ew-resize",
  bottom: "ns-resize",
  corner: "nwse-resize",
}

// `fitZoom` : niveau de zoom après un recadrage (1 = tout l'objet et le texte remplissent l'aperçu,
// 0.8 = 80 %, un peu d'air autour)
export function createPreviewController(
  redraw: () => void,
  { fitZoom = 1 }: { fitZoom?: number } = {}
) {
  const view: View & { fitS: number; user: boolean } = {
    s: 1,
    ox: 0,
    oy: 0,
    fitS: 1,
    user: false,
  }
  let props: PreviewProps | null = null
  let size = { w: 1, h: 1 }
  let hover: HitKind | null = null
  let drag: Drag | null = null
  let lastMode: string | null = null

  function setProps(p: PreviewProps) {
    props = p
    // premier affichage et changement de mode : on recadre, comme dans le plugin
    if (lastMode !== p.mode) {
      lastMode = p.mode
      fit(true)
    }
  }

  function setSize(w: number, h: number) {
    if (w === size.w && h === size.h) return
    size = { w, h }
    fit(false)
  }

  function fit(force: boolean) {
    if (!props || (view.user && !force)) return
    const v = fitView(size.w, size.h, props)
    // on part du cadrage plein, puis on dézoome autour du centre de l'aperçu
    const cx = size.w / 2
    const cy = size.h / 2
    Object.assign(view, {
      s: v.s * fitZoom,
      ox: cx - (cx - v.ox) * fitZoom,
      oy: cy - (cy - v.oy) * fitZoom,
      fitS: v.s,
      user: false,
    })
    props.onZoom(Math.round(fitZoom * 100))
  }

  function zoomAt(factor: number, sx: number, sy: number) {
    const s = Math.min(
      view.fitS * 24,
      Math.max(view.fitS * 0.25, view.s * factor)
    )
    view.ox = sx - (sx - view.ox) * (s / view.s)
    view.oy = sy - (sy - view.oy) * (s / view.s)
    view.s = s
    view.user = true
    props?.onZoom(Math.round((s / view.fitS) * 100))
    redraw()
  }

  function colRect(c: Rect) {
    return {
      x: view.ox + c.x * view.s,
      y: view.oy + c.y * view.s,
      w: c.w * view.s,
      h: c.h * view.s,
    }
  }

  function toWorld(sx: number, sy: number) {
    return { x: (sx - view.ox) / view.s, y: (sy - view.oy) / view.s, sx, sy }
  }

  // hit() de ui.html (zones un peu plus larges au doigt)
  function hit(
    p: { x: number; y: number; sx: number; sy: number },
    touch: boolean
  ): HitKind | null {
    if (!props) return null
    const st = props
    if (st.mode === "around") {
      const c = colRect(st.col)
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
    const tol = (touch ? 10 : 4) / view.s
    if (
      p.x >= m.x - tol &&
      p.x <= m.x + m.w + tol &&
      p.y >= m.y - tol &&
      p.y <= m.y + m.h + tol
    ) {
      const row = Math.min(
        m.ih - 1,
        Math.max(0, Math.floor(((p.y - m.y) * m.ih) / m.h))
      )
      const sx = m.iw / m.w
      if (
        m.left[row] >= 0 &&
        p.x >= m.x + m.left[row] / sx - tol &&
        p.x <= m.x + (m.right[row] + 1) / sx + tol
      )
        return "obj"
    }
    const c = st.col
    if (
      st.mode === "around" &&
      p.x >= c.x &&
      p.x <= c.x + c.w &&
      p.y >= c.y &&
      p.y <= c.y + c.h
    )
      return "text"
    return null
  }

  function down(e: PreviewPointer) {
    if (!props) return
    const p = toWorld(e.sx, e.sy)
    const h = e.pan ? null : hit(p, e.touch)
    if (!h) {
      drag = { kind: "pan", sx: e.sx, sy: e.sy, ox: view.ox, oy: view.oy }
      return
    }
    const st = props
    const orig =
      h === "obj"
        ? { x: st.mask.x, y: st.mask.y, w: st.mask.w, h: st.mask.h }
        : { ...st.col }
    drag = { kind: h, start: { x: p.x, y: p.y }, orig }
    redraw()
  }

  // renvoie true si quelque chose a bougé
  function move(e: PreviewPointer) {
    if (!props) return
    const p = toWorld(e.sx, e.sy)
    const d = drag
    const st = props
    if (d && d.kind === "pan") {
      view.ox = d.ox + e.sx - d.sx
      view.oy = d.oy + e.sy - d.sy
      if (Math.abs(e.sx - d.sx) + Math.abs(e.sy - d.sy) > 2) view.user = true
      redraw()
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
        const h =
          d.kind !== "right" ? Math.max(st.metrics.lh, d.orig.h + dy) : d.orig.h
        st.onCol({ ...d.orig, w, h }, d.kind !== "right")
      }
      return
    }
    if (e.touch) return
    const h = hit(p, false)
    if (h !== hover) {
      hover = h
      redraw()
    }
  }

  function up() {
    const d = drag
    if (!d) return
    drag = null
    if (d.kind !== "pan") fit(false)
    redraw()
  }

  function leave() {
    if (!drag && hover) {
      hover = null
      redraw()
    }
  }

  // molette : déplacement, ou zoom avec Ctrl/Cmd
  function wheel(e: {
    sx: number
    sy: number
    dx: number
    dy: number
    zoom: boolean
  }) {
    if (e.zoom)
      zoomAt(Math.min(2, Math.max(0.5, Math.exp(-e.dy * 0.01))), e.sx, e.sy)
    else {
      view.ox -= e.dx
      view.oy -= e.dy
      view.user = true
      redraw()
    }
  }

  function draw(ctx: CanvasRenderingContext2D) {
    if (!props) return
    drawPreview(ctx, size.w, size.h, {
      view,
      mask: props.mask,
      col: props.col,
      mode: props.mode,
      metrics: props.metrics,
      comp: props.comp,
      font: props.font,
      hover,
      drag: drag && drag.kind !== "pan" ? drag.kind : null,
      result: props.result,
      hint: props.hint,
    })
  }

  // le curseur à afficher au survol
  function cursor(spaceDown = false) {
    if (drag)
      return drag.kind === "pan" || drag.kind === "obj" || drag.kind === "text"
        ? "grabbing"
        : PREVIEW_CURSORS[drag.kind]
    if (spaceDown) return "grab"
    return hover ? PREVIEW_CURSORS[hover] : view.user ? "grab" : "default"
  }

  const zoom: ZoomApi = {
    zoomIn: () => zoomAt(1.5, size.w / 2, size.h / 2),
    zoomOut: () => zoomAt(1 / 1.5, size.w / 2, size.h / 2),
    fit: () => {
      fit(true)
      redraw()
    },
  }

  return {
    setProps,
    setSize,
    fit: (force: boolean) => fit(force),
    down,
    move,
    up,
    leave,
    wheel,
    draw,
    cursor,
    zoom,
    isDragging: () => drag !== null,
  }
}

export type PreviewController = ReturnType<typeof createPreviewController>
