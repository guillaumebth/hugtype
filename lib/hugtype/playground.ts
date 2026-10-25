// Version web de la « scène » du plugin : mesure du texte, masque de l'image
// et calcul de la mise en page. Les algorithmes viennent de engine.js.

import {
  layout,
  outlinePath,
  type Alpha,
  type LayoutResult,
  type Mask,
  type OutlinePath,
  type Settings,
  type Word,
} from "@/lib/hugtype/engine"

export type FontChoice = { id: string; label: string; family: string; weight: number; svgFamily: string }

export type Metrics = {
  paras: Word[][]
  dict: Record<string, { w: number; t: string }>
  lh: number
  fontSize: number
  spaceW: number
}

export type Rect = { x: number; y: number; w: number; h: number }

export type Cutout = {
  id: string
  label: string
  img: CanvasImageSource & { width: number; height: number }
  alpha: Alpha
  transparent: boolean
}

export type Composition = {
  result: LayoutResult | null
  pathRes: PathResult | null
  info: string
}

export type PathResult = {
  path: OutlinePath
  placed: { w: Word; at: number; len: number; extra: number }[]
  extra: number
  ratio: number
}

export function fontCss(f: FontChoice, px: number) {
  return `${f.weight} ${px}px ${f.family}`
}

// ---------- Texte -> paragraphes de mots mesurés (remplace la mesure Figma) ----------
export function measureText(text: string, font: FontChoice, size: number, lineHeight: number): Metrics {
  const c = document.createElement("canvas").getContext("2d")
  if (!c) throw new Error("Canvas unavailable")
  c.font = fontCss(font, size)
  const width = (s: string) => c.measureText(s).width

  const paras: Word[][] = [[]]
  const dict: Metrics["dict"] = {}
  const cache = new Map<string, string>()
  const re = /[^\s ]+/g
  let m: RegExpExecArray | null
  let lastEnd = 0
  while ((m = re.exec(text))) {
    const s = m.index
    const e = s + m[0].length
    const nl = (text.slice(lastEnd, s).match(/\n/g) || []).length
    for (let k = 0; k < nl; k++) paras.push([])
    lastEnd = e
    let key = cache.get(m[0])
    if (!key) {
      key = "w" + cache.size
      cache.set(m[0], key)
      dict[key] = { w: width(m[0]), t: m[0] }
    }
    const sep = e < text.length && /[\s ]/.test(text[e]) ? e : -1
    paras[paras.length - 1].push({ k: key, s, e, sep })
  }
  const tail = (text.slice(lastEnd).match(/\n/g) || []).length
  for (let t = 0; t < tail; t++) paras.push([])
  while (paras.length > 1 && !paras[paras.length - 1].length) paras.pop()

  return {
    paras,
    dict,
    lh: size * lineHeight,
    fontSize: size,
    spaceW: width("a a") - width("aa"),
  }
}

// ---------- Image -> canal alpha (comme decode() dans ui.html) ----------
export async function loadCutout(id: string, label: string, src: string): Promise<Cutout> {
  const img = new Image()
  img.decoding = "async"
  img.src = src
  await img.decode()
  const iw = img.naturalWidth || 1000
  const ih = img.naturalHeight || 1000
  const scale = Math.min(1, 900 / Math.max(iw, ih))
  const w = Math.max(1, Math.round(iw * scale))
  const h = Math.max(1, Math.round(ih * scale))
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  const x = c.getContext("2d", { willReadFrequently: true })
  if (!x) throw new Error("Canvas unavailable")
  x.drawImage(img, 0, 0, w, h)
  const d = x.getImageData(0, 0, w, h).data
  const a = new Uint8Array(w * h)
  let clear = 0
  for (let i = 0; i < a.length; i++) {
    a[i] = d[i * 4 + 3]
    if (a[i] < 250) clear++
  }
  // image affichée en pleine définition
  const full = img as HTMLImageElement & { width: number; height: number }
  return { id, label, img: full, alpha: { w, h, a }, transparent: clear > a.length * 0.01 }
}

export function buildMask(alpha: Alpha, obj: Rect, threshold: number): Mask {
  const t = (threshold / 100) * 255
  const { w, h } = alpha
  const left = new Int16Array(h)
  const right = new Int16Array(h)
  for (let y = 0; y < h; y++) {
    let L = -1
    let R = -1
    const row = y * w
    for (let x = 0; x < w; x++)
      if (alpha.a[row + x] > t) {
        L = x
        break
      }
    if (L >= 0)
      for (let x = w - 1; x >= L; x--)
        if (alpha.a[row + x] > t) {
          R = x
          break
        }
    left[y] = L
    right[y] = R
  }
  return { x: obj.x, y: obj.y, w: obj.w, h: obj.h, iw: w, ih: h, left, right }
}

// Le contour ne dépend ni du texte ni du point de départ : on garde le dernier calcul
let outlineCache: { key: string; alpha: Alpha; path: OutlinePath | null } | null = null

function cachedOutline(alpha: Alpha, obj: Rect, s: Settings) {
  const key = [obj.x, obj.y, obj.w, obj.h, s.margin, s.smooth, s.threshold, s.pathSide].join("|")
  if (outlineCache && outlineCache.key === key && outlineCache.alpha === alpha) return outlineCache.path
  const path = outlinePath([{ x: obj.x, y: obj.y, w: obj.w, h: obj.h, al: alpha }], {
    margin: s.margin,
    smooth: s.smooth,
    threshold: s.threshold,
    inward: s.pathSide === "in",
  })
  outlineCache = { key, alpha, path }
  return path
}

// ---------- Mise en page (relayout() du plugin) ----------
export function compose(p: {
  metrics: Metrics
  settings: Settings
  mask: Mask
  alpha: Alpha
  obj: Rect
  col: Rect
  fixedH: boolean
}): Composition {
  const { metrics: mt, settings: s, mask, alpha, obj, col } = p
  const wordW = (w: Word) => mt.dict[w.k].w

  if (s.mode === "outline") {
    const path = cachedOutline(alpha, obj, s)
    if (!path) return { result: null, pathRes: null, info: "No outline found" }
    const words: Word[] = []
    let chars = 0
    mt.paras.forEach((para) =>
      para.forEach((w) => {
        words.push(w)
        chars += w.e - w.s
      })
    )
    chars += Math.max(0, words.length - 1)
    const textLen =
      words.reduce((a, w) => a + wordW(w), 0) + Math.max(0, words.length - 1) * mt.spaceW
    const extra = s.pathFit === "fit" && chars > 0 ? (path.length - textLen) / chars : 0
    const t = (s.start / 100) * path.N
    const seg = Math.min(path.N - 1, Math.floor(t))
    const pos = t - seg
    const segLen = (seg + 1 < path.N ? path.segStart[seg + 1] : path.length) - path.segStart[seg]
    const s0 = path.segStart[seg] + pos * segLen
    const placed: PathResult["placed"] = []
    let cur = 0
    words.forEach((w) => {
      const n = w.e - w.s
      const ww = wordW(w) + extra * n
      placed.push({ w, at: s0 + cur, len: ww, extra })
      cur += ww + mt.spaceW + extra
    })
    const pct = Math.round((textLen / path.length) * 100)
    return {
      result: null,
      pathRes: { path, placed, extra, ratio: textLen / path.length },
      info: s.pathFit !== "fit" && pct > 100 ? "Text too long · use Fill the loop" : "",
    }
  }

  const around = s.mode === "around"
  const placedMask = around ? { ...mask, x: mask.x - col.x, y: mask.y - col.y } : mask
  const result = layout({
    paras: mt.paras,
    W: col.w,
    maxH: around ? (p.fixedH ? col.h : null) : null,
    lh: mt.lh,
    fontSize: mt.fontSize,
    masks: [placedMask],
    settings: s,
    wordW,
    spaceW: mt.spaceW,
  })
  return {
    result,
    pathRes: null,
    info: result.remaining
      ? `${result.remaining} word${result.remaining > 1 ? "s" : ""} overflow`
      : "",
  }
}
