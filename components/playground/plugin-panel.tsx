"use client"

import { useEffect, useRef, useState } from "react"

import { Label, Seg, Slider } from "@/components/playground/panel-ui"
import { PluginPreview, type ZoomApi } from "@/components/playground/plugin-preview"
import type { Settings } from "@/lib/hugtype/engine"
import { fontSans } from "@/lib/fonts"
import { FIGMA_URL } from "@/lib/site"
import { cn } from "@/lib/utils"
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

const FONT: FontChoice = {
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
const TEXT_BOX: Rect = { x: 0, y: 0, w: 330, h: 0 }
const OBJ_W = 200

export function PluginPanel() {
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
  const zoomRef = useRef<ZoomApi | null>(null)
  // dès que la personne touche à quelque chose, l'animation d'intro s'arrête
  const touched = useRef(false)

  useEffect(() => {
    let alive = true
    loadCutout("jacket", "Jacket", "/samples/jacket.png").then((c) => {
      if (alive) setCutout(c)
    })
    document.fonts.load(fontCss(FONT, FONT_SIZE), TEXT.slice(0, 120)).then(() => {
      if (!alive) return
      setTextMetrics(measureText(TEXT, FONT, FONT_SIZE, LINE_HEIGHT))
      setOutlineMetrics(measureText(OUTLINE_TEXT, FONT, FONT_SIZE, LINE_HEIGHT))
    })
    return () => {
      alive = false
    }
  }, [])

  // Intro : la veste glisse en place et le texte se recompose autour, en direct
  useEffect(() => {
    if (!cutout || !textMetrics || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
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
  }, [cutout, textMetrics])

  const metrics = settings.mode === "outline" ? outlineMetrics : textMetrics
  // En Outline, sous ~14 px le texte passe sur l'objet (le lissage arrondit les creux) : on garde un minimum
  const minMargin = settings.mode === "outline" ? 14 : 0
  const margin = Math.max(minMargin, settings.margin)
  const home = cutout ? defaultObj(cutout) : null
  const place = obj ?? home
  const mask = cutout && place ? buildMask(cutout.alpha, place, settings.threshold) : null
  const comp =
    cutout && metrics && mask && place
      ? compose({ metrics, settings: { ...settings, margin }, mask, alpha: cutout.alpha, obj: place, col, fixedH })
      : null
  const colH = fixedH ? col.h : Math.max(comp?.result?.height ?? 0, metrics?.lh ?? 0)
  const moved =
    (obj && home && (obj.x !== home.x || obj.y !== home.y)) ||
    col.x !== TEXT_BOX.x ||
    col.y !== TEXT_BOX.y ||
    col.w !== TEXT_BOX.w ||
    fixedH

  function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    touched.current = true
    setSettings((s) => ({ ...s, [k]: v }))
  }

  const mode = settings.mode
  const offsetLabel = mode === "inside" ? "Inset" : mode === "outline" ? "Distance" : "Offset"

  return (
    <div className="flex size-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#2e2e2e] bg-black text-[11px] leading-4 text-white shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
      {/* Sélecteur de mode */}
      <div className="flex shrink-0 gap-1 px-3 pt-3">
        {(
          [
            ["around", "Around"],
            ["inside", "Inside"],
            ["outline", "Outline"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => set("mode", v)}
            className={cn(
              "flex-1 cursor-pointer rounded-md px-2.5 py-[7px] text-center font-semibold text-[#8c8c8c] transition-colors hover:bg-[#2a2a2a] hover:text-white",
              mode === v && "bg-[#1e1e1e] text-white shadow-[inset_0_0_0_1px_#2e2e2e]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        {/* Aperçu : prend toute la hauteur disponible */}
        <div className="flex min-h-[120px] flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-hidden rounded-t-lg bg-[#111]">
            {comp && mask && metrics && place && cutout && (
              <PluginPreview
                mask={mask}
                col={{ ...col, h: colH }}
                mode={mode}
                metrics={metrics}
                comp={comp}
                font={FONT}
                result={view === "result" ? cutout.img : null}
                hint={hint}
                onObj={(r) => {
                  touched.current = true
                  setHint(false)
                  setObj(r)
                }}
                onCol={(r, makeFixed) => {
                  touched.current = true
                  setCol({ ...r, h: makeFixed ? r.h : col.h })
                  if (makeFixed) setFixedH(true)
                }}
                onZoom={setZoom}
                zoomRef={zoomRef}
              />
            )}
          </div>
          <div className="flex min-h-[30px] shrink-0 items-center justify-between gap-2 rounded-b-lg bg-[#111] py-1 pr-1.5 pl-2.5 font-mono text-[10px] tracking-[0.04em] uppercase">
            {/* Aperçu hachuré du plugin, ou rendu final : segment comme dans le plugin */}
            <span className="grid grid-cols-2 gap-0.5 rounded-md bg-[#1e1e1e] p-0.5 font-sans text-[11px] tracking-normal normal-case">
              {(
                [
                  ["preview", "Preview"],
                  ["result", "Result"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    "cursor-pointer rounded-[4px] px-2 py-[3px] text-[#8c8c8c] transition-colors hover:text-white",
                    view === v && "bg-[#2a2a2a] font-medium text-white shadow-[inset_0_0_0_1px_#2e2e2e]"
                  )}
                >
                  {label}
                </button>
              ))}
            </span>
            <span className="flex items-center gap-0.5">
              {moved && (
                <button
                  type="button"
                  onClick={() => {
                    setObj(null)
                    setCol(TEXT_BOX)
                    setFixedH(false)
                    zoomRef.current?.fit()
                  }}
                  className="mr-2 cursor-pointer text-[10px] underline underline-offset-2 hover:text-[#8c8c8c]"
                >
                  Reset
                </button>
              )}
              <span className="hidden items-center gap-0.5 md:flex">
                <button type="button" aria-label="Zoom out" onClick={() => zoomRef.current?.zoomOut()} className="h-[22px] min-w-[22px] cursor-pointer rounded px-1 hover:bg-[#2a2a2a]">
                  −
                </button>
                <button type="button" title="Fit (double-click the preview)" onClick={() => zoomRef.current?.fit()} className="h-[22px] min-w-[44px] cursor-pointer rounded px-1 text-center hover:bg-[#2a2a2a]">
                  {zoom}%
                </button>
                <button type="button" aria-label="Zoom in" onClick={() => zoomRef.current?.zoomIn()} className="h-[22px] min-w-[22px] cursor-pointer rounded px-1 hover:bg-[#2a2a2a]">
                  +
                </button>
              </span>
            </span>
          </div>
        </div>

        {/* Deux réglages par mode, l'essentiel du plugin */}
        <div className="flex shrink-0 flex-col gap-3">
          {mode === "around" && (
            <div>
              <Label>Side</Label>
              <Seg
                cols={3}
                value={settings.side}
                onChange={(v) => set("side", v)}
                options={[
                  { v: "left", label: "Left" },
                  { v: "right", label: "Right" },
                  { v: "all", label: "Both" },
                ]}
              />
            </div>
          )}

          {mode === "inside" && (
            <div>
              <Label>Align</Label>
              <Seg
                cols={4}
                value={settings.alignInside}
                onChange={(v) => set("alignInside", v)}
                options={[
                  { v: "left", label: "Left" },
                  { v: "center", label: "Center" },
                  { v: "right", label: "Right" },
                  { v: "justify", label: "Justify" },
                ]}
              />
            </div>
          )}

          {mode === "outline" && (
            <div>
              <Label aside={`${settings.start}%`}>Start point</Label>
              <Slider label="Start point" value={settings.start} min={0} max={100} onChange={(v) => set("start", v)} />
            </div>
          )}

          <div>
            <Label aside="px">{offsetLabel}</Label>
            <Slider label={offsetLabel} value={margin} min={minMargin} max={80} onChange={(v) => set("margin", v)} number />
          </div>
        </div>

        {/* Bouton principal, comme « Wrap text » dans le plugin */}
        <a
          href={FIGMA_URL}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center justify-center gap-2 rounded-md bg-white p-[9px] font-semibold text-black transition-colors hover:bg-neutral-300 focus-visible:bg-neutral-300 focus-visible:outline-none"
        >
          <FigmaLogo className="h-3.5 w-auto" />
          Test on Figma
        </a>
      </div>
    </div>
  )
}

// La veste à droite de la colonne, en haut, comme dans les maquettes du plugin
function defaultObj(c: Cutout): Rect {
  const h = (OBJ_W * c.alpha.h) / c.alpha.w
  return { x: TEXT_BOX.w - OBJ_W + 40, y: 20, w: OBJ_W, h }
}

// Logo Figma (les cinq formes, couleurs officielles)
function FigmaLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 38 57" aria-hidden="true" className={className}>
      <path fill="#1abcfe" d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" />
      <path fill="#0acf83" d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" />
      <path fill="#ff7262" d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" />
      <path fill="#f24e1e" d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" />
      <path fill="#a259ff" d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" />
    </svg>
  )
}
