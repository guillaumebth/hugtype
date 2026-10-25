// Aperçu du panneau, repris de draw() / drawOutline() / outline() / hatch() dans ui.html

import { pointAt, type Mask } from "@/lib/hugtype/engine"
import { fontCss, type Composition, type FontChoice, type Metrics, type Rect } from "@/lib/hugtype/playground"

export type View = { s: number; ox: number; oy: number }
export type HitKind = "obj" | "text" | "right" | "bottom" | "corner"

const INK = "#fff"
const DIM = "#8c8c8c"
const ACID = "#f24822"
const PAPER = "#e9e9e6"

const hatchCache = new WeakMap<CanvasRenderingContext2D, CanvasPattern>()

function hatch(ctx: CanvasRenderingContext2D) {
  const cached = hatchCache.get(ctx)
  if (cached) return cached
  const c = document.createElement("canvas")
  const dpr = window.devicePixelRatio || 1
  c.width = c.height = Math.round(7 * dpr)
  const x = c.getContext("2d")
  if (!x) return INK
  x.scale(dpr, dpr)
  x.strokeStyle = "#fff"
  x.lineWidth = 1
  x.globalAlpha = 0.45
  x.beginPath()
  x.moveTo(-1, 8)
  x.lineTo(8, -1)
  x.moveTo(6, 8)
  x.lineTo(8, 6)
  x.moveTo(-1, 1)
  x.lineTo(1, -1)
  x.stroke()
  const p = ctx.createPattern(c, "repeat")
  if (!p) return INK
  p.setTransform(new DOMMatrix().scale(1 / dpr))
  hatchCache.set(ctx, p)
  return p
}

function outline(ctx: CanvasRenderingContext2D, m: Mask, v: View) {
  const sx = m.iw / m.w
  const sy = m.ih / m.h
  const step = Math.max(1, Math.floor(m.ih / 240))
  const X = (x: number) => v.ox + (m.x + x / sx) * v.s
  const Y = (r: number) => v.oy + (m.y + r / sy) * v.s
  let r = 0
  while (r < m.ih) {
    while (r < m.ih && m.left[r] < 0) r++
    if (r >= m.ih) break
    const start = r
    while (r < m.ih && m.left[r] >= 0) r++
    const end = r - 1
    const rows: number[] = []
    for (let q = start; q <= end; q += step) rows.push(q)
    if (rows[rows.length - 1] !== end) rows.push(end)
    ctx.moveTo(X(m.left[start]), Y(start))
    rows.forEach((q) => ctx.lineTo(X(m.left[q]), Y(q + 0.5)))
    ctx.lineTo(X(m.left[end]), Y(end + 1))
    ctx.lineTo(X(m.right[end] + 1), Y(end + 1))
    for (let i = rows.length - 1; i >= 0; i--) ctx.lineTo(X(m.right[rows[i]] + 1), Y(rows[i] + 0.5))
    ctx.lineTo(X(m.right[start] + 1), Y(start))
    ctx.closePath()
  }
}

// Cadrage sur l'objet, la colonne et le contour (fit() dans ui.html)
export function fitView(
  width: number,
  height: number,
  p: { mask: Mask; col: Rect; mode: string; metrics: Metrics; comp: Composition }
): View {
  const pad = 18
  const { mask: m, col, metrics: mt } = p
  let x0 = m.x
  let y0 = m.y
  let x1 = m.x + m.w
  let y1 = m.y + m.h
  if (p.mode === "around") {
    x0 = Math.min(x0, col.x)
    y0 = Math.min(y0, col.y)
    x1 = Math.max(x1, col.x + col.w)
    y1 = Math.max(y1, col.y + col.h)
  }
  if (p.comp.pathRes)
    for (const q of p.comp.pathRes.path.dense) {
      x0 = Math.min(x0, q.x - mt.fontSize)
      y0 = Math.min(y0, q.y - mt.fontSize)
      x1 = Math.max(x1, q.x + mt.fontSize)
      y1 = Math.max(y1, q.y + mt.fontSize)
    }
  const s = Math.min((width - pad * 2) / (x1 - x0), (height - pad * 2) / (y1 - y0))
  return { s, ox: (width - (x1 - x0) * s) / 2 - x0 * s, oy: (height - (y1 - y0) * s) / 2 - y0 * s }
}

export function drawPreview(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  p: {
    view: View
    mask: Mask
    col: Rect
    mode: "around" | "inside" | "outline"
    metrics: Metrics
    comp: Composition
    font: FontChoice
    hover: HitKind | null
    drag: HitKind | null
    // rendu final : la vraie image et le texte noir sur papier, sans les repères
    result: CanvasImageSource | null
    hint: boolean
  }
) {
  const { view: v, mask: m, col, mode, comp, hover, drag, result } = p
  ctx.clearRect(0, 0, width, height)
  const X = (x: number) => v.ox + x * v.s
  const Y = (y: number) => v.oy + y * v.s
  const ink = result ? "#111" : INK

  if (result) {
    ctx.fillStyle = PAPER
    ctx.fillRect(0, 0, width, height)
    // en Inside, l'image est masquée : le texte seul dessine la silhouette
    if (mode !== "inside") ctx.drawImage(result, X(m.x), Y(m.y), m.w * v.s, m.h * v.s)
    drawText(ctx, { ...p, X, Y, ink })
    if (p.hint) drawHint(ctx, X(m.x + m.w / 2), Y(m.y))
    return
  }

  // grille de points
  ctx.fillStyle = "#fff"
  ctx.globalAlpha = 0.22
  for (let gx = 8; gx < width; gx += 16) for (let gy = 8; gy < height; gy += 16) ctx.fillRect(gx, gy, 1, 1)
  ctx.globalAlpha = 1

  // objet hachuré, contour blanc
  const active = drag === "obj" || (!drag && hover === "obj")
  ctx.beginPath()
  outline(ctx, m, v)
  ctx.fillStyle = "#111"
  ctx.fill("evenodd")
  if (active) {
    ctx.fillStyle = ACID
    ctx.globalAlpha = 0.35
    ctx.fill("evenodd")
    ctx.globalAlpha = 1
  }
  ctx.fillStyle = hatch(ctx)
  ctx.fill("evenodd")
  ctx.lineWidth = active ? 2.5 : 2
  ctx.strokeStyle = "#fff"
  ctx.stroke()

  // texte le long du contour
  if (mode === "outline" && comp.pathRes) {
    const pr = comp.pathRes
    const P = pr.path
    ctx.save()
    ctx.setLineDash([3, 4])
    ctx.strokeStyle = DIM
    ctx.lineWidth = 1
    ctx.beginPath()
    P.dense.forEach((q, i) => (i ? ctx.lineTo(X(q.x), Y(q.y)) : ctx.moveTo(X(q.x), Y(q.y))))
    ctx.closePath()
    ctx.stroke()
    ctx.restore()
    const startAt = pr.placed.length ? pr.placed[0].at : 0
    const st = pointAt(P, startAt)
    ctx.fillStyle = ACID
    ctx.beginPath()
    ctx.arc(X(st.x), Y(st.y), 4, 0, 7)
    ctx.fill()
    drawText(ctx, { ...p, X, Y, ink })
    if (p.hint) drawHint(ctx, X(m.x + m.w / 2), Y(m.y))
    return
  }

  // colonne de texte + poignées
  if (mode === "around") {
    const c = { x: X(col.x), y: Y(col.y), w: col.w * v.s, h: col.h * v.s }
    const activeCol = drag && drag !== "obj"
    ctx.save()
    ctx.setLineDash([6, 4])
    ctx.lineWidth = activeCol ? 2 : 1.5
    ctx.strokeStyle = "#fff"
    ctx.strokeRect(Math.round(c.x) + 0.5, Math.round(c.y) + 0.5, c.w, c.h)
    ctx.restore()
    const handles: [number, number, HitKind][] = [
      [c.x + c.w, c.y + c.h / 2, "right"],
      [c.x + c.w / 2, c.y + c.h, "bottom"],
      [c.x + c.w, c.y + c.h, "corner"],
    ]
    for (const [x, y, k] of handles) {
      ctx.fillStyle = hover === k || drag === k ? ACID : "#fff"
      ctx.fillRect(x - 5, y - 5, 10, 10)
    }
  }

  drawText(ctx, { ...p, X, Y, ink })
  if (p.hint) drawHint(ctx, X(m.x + m.w / 2), Y(m.y))
}

type TextArgs = {
  mode: "around" | "inside" | "outline"
  col: Rect
  metrics: Metrics
  comp: Composition
  font: FontChoice
  view: View
  X: (x: number) => number
  Y: (y: number) => number
  ink: string
}

// Le texte composé : le long du contour, ou ligne par ligne
function drawText(ctx: CanvasRenderingContext2D, p: TextArgs) {
  const { view: v, col, mode, metrics: mt, comp, font, X, Y, ink } = p
  if (mode === "outline" && comp.pathRes) {
    const pr = comp.pathRes
    const P = pr.path
    const startAt = pr.placed.length ? pr.placed[0].at : 0
    ctx.textBaseline = "alphabetic"
    ctx.fillStyle = ink
    ctx.font = fontCss(font, mt.fontSize * v.s)
    const limit = P.length + 0.5
    for (const pw of pr.placed) {
      if (pw.at - startAt + pw.len > limit) continue
      const d = mt.dict[pw.w.k]
      const chars = [...d.t].map((c) => ({ c, w: ctx.measureText(c).width / v.s }))
      const sum = chars.reduce((a, c) => a + c.w, 0) || 1
      const k = d.w / sum
      let at = pw.at
      for (const c of chars) {
        const cw = c.w * k
        const q = pointAt(P, at + cw / 2)
        ctx.save()
        ctx.translate(X(q.x), Y(q.y))
        ctx.rotate(q.ang)
        ctx.fillText(c.c, (-cw * v.s) / 2, 0, Math.max(1, cw * v.s))
        ctx.restore()
        at += cw + pw.extra
      }
    }
    return
  }
  if (comp.result) {
    const tx = mode === "around" ? col.x : 0
    const ty = mode === "around" ? col.y : 0
    const px = mt.fontSize * v.s
    ctx.textBaseline = "middle"
    ctx.font = fontCss(font, px)
    for (const l of comp.result.lines) {
      const y = Y(ty + l.y + mt.lh / 2)
      l.words.forEach((w, k) => {
        const d = mt.dict[w.k]
        const x = X(tx + l.xs[k])
        if (px < 4) {
          ctx.fillStyle = DIM
          ctx.fillRect(x, y - px * 0.3, d.w * v.s, Math.max(1, px * 0.6))
          return
        }
        ctx.fillStyle = ink
        ctx.fillText(d.t, x, y, Math.max(1, d.w * v.s))
      })
    }
  }
}

// Petite étiquette « Drag me » posée sur le coin de l'objet
function drawHint(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const label = "DRAG ME"
  ctx.save()
  ctx.font = "600 9px ui-monospace, Menlo, monospace"
  const w = ctx.measureText(label).width + 12
  const h = 17
  const bx = Math.round(x - w / 2)
  const by = Math.round(y - h - 2)
  ctx.fillStyle = ACID
  ctx.beginPath()
  ctx.roundRect(bx, by, w, h, h / 2)
  ctx.fill()
  ctx.fillStyle = "#fff"
  ctx.textBaseline = "middle"
  ctx.fillText(label, bx + 6, by + h / 2 + 0.5)
  ctx.restore()
}
