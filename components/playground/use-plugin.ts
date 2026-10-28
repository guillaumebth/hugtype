"use client"

import { useEffect, useRef, useState } from "react"

import type { ZoomApi } from "@/components/playground/plugin-preview"
import type { Settings } from "@/lib/hugtype/engine"
import { fontSans } from "@/lib/fonts"
import {
  buildMask,
  compose,
  fontCss,
  loadCutout,
  measureText,
  type Cutout,
  type FontChoice,
  type Metrics,
  type Rect,
} from "@/lib/hugtype/playground"

// Le texte et l'image de la démo (on ne peut pas les changer : c'est une démo, pas un outil en ligne)
const TEXT = `There is a particular kind of confidence that only shows up when someone stops moving. Walking is easy to style: the stride does half the work, the fabric swings, the shoes get their moment between steps. Sitting is different. You take a chair, you lean back, you let the outfit settle around you. Then the jacket. A track jacket was built for warming up, for the minutes before the real effort. Black nylon, white lettering stitched across the shoulders and down the sleeves. Embroidery changes everything about a jacket like this: print sits on the surface, thread sinks into it.`

// Le long du contour, une ligne plus courte : elle fait à peu près le tour de la veste
const OUTLINE_TEXT =
  "Spellout embroidered track jacket. Black nylon, white lettering stitched across the shoulders and down the sleeves. Thread sinks into the fabric. Today's fit, seated. Supreme, 2026."

export const FONT: FontChoice = {
  id: "inter",
  label: "Inter Tight",
  family: fontSans.style.fontFamily,
  weight: 500,
  svgFamily: "Inter Tight",
}
const FONT_SIZE = 11
const LINE_HEIGHT = 14 / 11

// Réglages par défaut du plugin (DEFAULTS dans code.js + ui.html)
const DEFAULTS: Settings = {
  mode: "around",
  side: "left",
  margin: 12,
  align: "contour",
  alignInside: "center",
  threshold: 10,
  smooth: 40,
  start: 0,
  pathFit: "natural",
  pathSide: "out",
  hideObj: false,
}

// Boîte de texte et position de la veste, dans le repère de la boîte (comme dans Figma)
export const TEXT_BOX: Rect = { x: 0, y: 0, w: 330, h: 0 }
const OBJ_W = 200

// Les sliders que la molette de l'objet 3D peut piloter
export type SliderKey = "margin" | "start"

// Tout l'état du plugin, partagé entre le panneau à plat (v1) et les écrans de l'objet 3D (v2)
export function usePlugin({
  introReady = true,
}: { introReady?: boolean } = {}) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [cutout, setCutout] = useState<Cutout | null>(null)
  const [textMetrics, setTextMetrics] = useState<Metrics | null>(null)
  const [outlineMetrics, setOutlineMetrics] = useState<Metrics | null>(null)
  const [obj, setObj] = useState<Rect | null>(null)
  const [col, setCol] = useState<Rect>(TEXT_BOX)
  const [fixedH, setFixedH] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [view, setView] = useState<"preview" | "result">("preview")
  const [hint, setHint] = useState(true)
  const [activeSlider, setActiveSlider] = useState<SliderKey>("margin")
  const zoomRef = useRef<ZoomApi | null>(null)
  // dès que la personne touche à quelque chose, l'animation d'intro s'arrête
  const touched = useRef(false)

  useEffect(() => {
    let alive = true
    loadCutout("jacket", "Jacket", "/samples/jacket.webp").then((c) => {
      if (alive) setCutout(c)
    })
    document.fonts
      .load(fontCss(FONT, FONT_SIZE), TEXT.slice(0, 120))
      .then(() => {
        if (!alive) return
        setTextMetrics(measureText(TEXT, FONT, FONT_SIZE, LINE_HEIGHT))
        setOutlineMetrics(
          measureText(OUTLINE_TEXT, FONT, FONT_SIZE, LINE_HEIGHT)
        )
      })
    return () => {
      alive = false
    }
  }, [])

  // Intro : la veste glisse en place et le texte se recompose autour, en direct
  // (`introReady` permet d'attendre, par exemple que le clapet de l'objet 3D soit ouvert)
  useEffect(() => {
    if (
      !introReady ||
      !cutout ||
      !textMetrics ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return
    const target = defaultObj(cutout)
    let raf = 0
    let t0 = 0
    const DURATION = 2400
    const FROM = -150
    function frame(now: number) {
      if (touched.current) return
      t0 ||= now
      const t = Math.min(1, (now - t0) / DURATION)
      const e = 1 - Math.pow(1 - t, 3)
      if (t < 1) {
        setObj({ ...target, x: target.x + FROM * (1 - e) })
        raf = requestAnimationFrame(frame)
      } else setObj(null)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [cutout, textMetrics, introReady])

  const metrics = settings.mode === "outline" ? outlineMetrics : textMetrics
  // En Outline, sous ~14 px le texte passe sur l'objet (le lissage arrondit les creux) : on garde un minimum
  const minMargin = settings.mode === "outline" ? 14 : 0
  const margin = Math.max(minMargin, settings.margin)
  const home = cutout ? defaultObj(cutout) : null
  const place = obj ?? home
  const mask =
    cutout && place ? buildMask(cutout.alpha, place, settings.threshold) : null
  const comp =
    cutout && metrics && mask && place
      ? compose({
          metrics,
          settings: { ...settings, margin },
          mask,
          alpha: cutout.alpha,
          obj: place,
          col,
          fixedH,
        })
      : null
  const colH = fixedH
    ? col.h
    : Math.max(comp?.result?.height ?? 0, metrics?.lh ?? 0)
  const moved = Boolean(
    (obj && home && (obj.x !== home.x || obj.y !== home.y)) ||
    col.x !== TEXT_BOX.x ||
    col.y !== TEXT_BOX.y ||
    col.w !== TEXT_BOX.w ||
    fixedH
  )

  function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    touched.current = true
    if (k === "mode") setActiveSlider(v === "outline" ? "start" : "margin")
    if (k === "margin" || k === "start") setActiveSlider(k)
    setSettings((s) => ({ ...s, [k]: v }))
  }

  const mode = settings.mode
  const offsetLabel =
    mode === "inside" ? "Inset" : mode === "outline" ? "Distance" : "Offset"

  // Bornes de chaque slider (les mêmes que dans le panneau)
  const sliderRange: Record<SliderKey, [number, number]> = {
    margin: [minMargin, 80],
    start: [0, 100],
  }

  // Molette : fait avancer le slider actif de `steps` crans
  function nudge(steps: number) {
    const key = mode === "outline" ? activeSlider : "margin"
    const [min, max] = sliderRange[key]
    const current = key === "margin" ? margin : settings.start
    const next = Math.min(max, Math.max(min, current + steps))
    if (next !== current) set(key, next)
    return next !== current
  }

  // La personne déplace la veste ou la boîte de texte dans l'aperçu
  function moveObj(r: Rect) {
    touched.current = true
    setHint(false)
    setObj(r)
  }
  function moveCol(r: Rect, makeFixed: boolean) {
    touched.current = true
    setCol({ ...r, h: makeFixed ? r.h : col.h })
    if (makeFixed) setFixedH(true)
  }

  function reset() {
    setObj(null)
    setCol(TEXT_BOX)
    setFixedH(false)
    zoomRef.current?.fit()
  }

  return {
    settings,
    set,
    mode,
    margin,
    minMargin,
    offsetLabel,
    cutout,
    metrics,
    mask,
    comp,
    place,
    col,
    colH,
    moveObj,
    moveCol,
    moved,
    reset,
    zoom,
    setZoom,
    zoomRef,
    view,
    setView,
    hint,
    activeSlider: mode === "outline" ? activeSlider : ("margin" as SliderKey),
    nudge,
  }
}

export type PluginState = ReturnType<typeof usePlugin>

// La veste à droite de la colonne, en haut, comme dans les maquettes du plugin
function defaultObj(c: Cutout): Rect {
  const h = (OBJ_W * c.alpha.h) / c.alpha.w
  return { x: TEXT_BOX.w - OBJ_W + 40, y: 20, w: OBJ_W, h }
}
