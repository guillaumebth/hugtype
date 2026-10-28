"use client"

import { Label, Seg, Slider } from "@/components/playground/panel-ui"
import { PluginPreview } from "@/components/playground/plugin-preview"
import {
  FONT,
  usePlugin,
  type PluginState,
  type SliderKey,
} from "@/components/playground/use-plugin"
import { FIGMA_URL } from "@/lib/site"
import { cn } from "@/lib/utils"

export function PluginPanel() {
  const p = usePlugin()

  return (
    <div className="flex size-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#2e2e2e] bg-black text-[11px] leading-4 text-white shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
      <ModeTabs p={p} className="px-3 pt-3" />

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        {/* Aperçu : prend toute la hauteur disponible */}
        <div className="flex min-h-[120px] flex-1 flex-col">
          <PreviewCanvas p={p} className="rounded-t-lg" />
          <PreviewBar p={p} className="rounded-b-lg" />
        </div>

        <Controls p={p} />
        <FigmaButton />
      </div>
    </div>
  )
}

// Sélecteur de mode
export function ModeTabs({
  p,
  className,
}: {
  p: PluginState
  className?: string
}) {
  return (
    <div className={cn("flex shrink-0 gap-1", className)}>
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
          onClick={() => p.set("mode", v)}
          className={cn(
            "flex-1 cursor-pointer rounded-md px-2.5 py-[7px] text-center font-semibold text-[#8c8c8c] transition-colors hover:bg-[#2a2a2a] hover:text-white",
            p.mode === v &&
              "bg-[#1e1e1e] text-white shadow-[inset_0_0_0_1px_#2e2e2e]"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// La zone de travail : veste + texte, déplaçables
export function PreviewCanvas({
  p,
  className,
}: {
  p: PluginState
  className?: string
}) {
  const { comp, mask, metrics, place, cutout } = p
  return (
    <div className={cn("min-h-0 flex-1 overflow-hidden bg-[#111]", className)}>
      {comp && mask && metrics && place && cutout && (
        <PluginPreview
          mask={mask}
          col={{ ...p.col, h: p.colH }}
          mode={p.mode}
          metrics={metrics}
          comp={comp}
          font={FONT}
          result={p.view === "result" ? cutout.img : null}
          hint={p.hint}
          onObj={p.moveObj}
          onCol={p.moveCol}
          onZoom={p.setZoom}
          zoomRef={p.zoomRef}
        />
      )}
    </div>
  )
}

// Aperçu hachuré / rendu final, Reset et zoom
export function PreviewBar({
  p,
  className,
}: {
  p: PluginState
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-[30px] shrink-0 items-center justify-between gap-2 bg-[#111] py-1 pr-1.5 pl-2.5 font-mono text-[10px] tracking-[0.04em] uppercase",
        className
      )}
    >
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
            onClick={() => p.setView(v)}
            className={cn(
              "cursor-pointer rounded-[4px] px-2 py-[3px] text-[#8c8c8c] transition-colors hover:text-white",
              p.view === v &&
                "bg-[#2a2a2a] font-medium text-white shadow-[inset_0_0_0_1px_#2e2e2e]"
            )}
          >
            {label}
          </button>
        ))}
      </span>
      <span className="flex items-center gap-0.5">
        {p.moved && (
          <button
            type="button"
            onClick={p.reset}
            className="mr-2 cursor-pointer text-[10px] underline underline-offset-2 hover:text-[#8c8c8c]"
          >
            Reset
          </button>
        )}
        <span className="hidden items-center gap-0.5 md:flex">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => p.zoomRef.current?.zoomOut()}
            className="h-[22px] min-w-[22px] cursor-pointer rounded px-1 hover:bg-[#2a2a2a]"
          >
            −
          </button>
          <button
            type="button"
            title="Fit (double-click the preview)"
            onClick={() => p.zoomRef.current?.fit()}
            className="h-[22px] min-w-[44px] cursor-pointer rounded px-1 text-center hover:bg-[#2a2a2a]"
          >
            {p.zoom}%
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => p.zoomRef.current?.zoomIn()}
            className="h-[22px] min-w-[22px] cursor-pointer rounded px-1 hover:bg-[#2a2a2a]"
          >
            +
          </button>
        </span>
      </span>
    </div>
  )
}

// Deux réglages par mode, l'essentiel du plugin.
// `wheel` : montre quel slider est relié à la molette de l'objet 3D
export function Controls({ p, wheel }: { p: PluginState; wheel?: boolean }) {
  const { mode, settings } = p
  const linked = (k: SliderKey) => wheel && p.activeSlider === k
  return (
    <div className="flex shrink-0 flex-col gap-3">
      {mode === "around" && (
        <div>
          <Label>Side</Label>
          <Seg
            cols={3}
            value={settings.side}
            onChange={(v) => p.set("side", v)}
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
            onChange={(v) => p.set("alignInside", v)}
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
          <Label aside={`${settings.start}%`}>
            <WheelMark on={linked("start")} />
            Start point
          </Label>
          <Slider
            label="Start point"
            value={settings.start}
            min={0}
            max={100}
            onChange={(v) => p.set("start", v)}
          />
        </div>
      )}

      <div>
        <Label aside="px">
          <WheelMark on={linked("margin")} />
          {p.offsetLabel}
        </Label>
        <Slider
          label={p.offsetLabel}
          value={p.margin}
          min={p.minMargin}
          max={80}
          onChange={(v) => p.set("margin", v)}
          number
        />
      </div>
    </div>
  )
}

// Petit point à côté du slider relié à la molette
function WheelMark({ on }: { on?: boolean }) {
  if (on === undefined) return null
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mr-1.5 inline-block size-1.5 -translate-y-px rounded-full align-middle transition-colors",
        on ? "bg-[#ff3410]" : "bg-transparent"
      )}
    />
  )
}

// Bouton principal, comme « Wrap text » dans le plugin
export function FigmaButton({ className }: { className?: string }) {
  return (
    <a
      href={FIGMA_URL}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "flex shrink-0 items-center justify-center gap-2 rounded-md bg-white p-[9px] font-semibold text-black transition-colors hover:bg-neutral-300 focus-visible:bg-neutral-300 focus-visible:outline-none",
        className
      )}
    >
      <FigmaLogo className="h-3.5 w-auto" />
      Test on Figma
    </a>
  )
}

// Logo Figma (les cinq formes, couleurs officielles)
export function FigmaLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 38 57" aria-hidden="true" className={className}>
      <path
        fill="#1abcfe"
        d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z"
      />
      <path
        fill="#0acf83"
        d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z"
      />
      <path fill="#ff7262" d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" />
      <path
        fill="#f24e1e"
        d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z"
      />
      <path
        fill="#a259ff"
        d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z"
      />
    </svg>
  )
}
