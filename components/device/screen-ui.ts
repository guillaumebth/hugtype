// L'interface du plugin dessinée directement sur les écrans de l'objet 3D (canvas → texture).
// Direction « appareil Braun » : touches, interrupteur à glissière, bouton rotatif à crans,
// cadrans gradués, légendes en minuscules, touches orange.
// Chaque écran a une mise en page (liste de zones) qui sert à la fois au dessin et aux clics.

import type { PluginState, SliderKey } from "@/components/playground/use-plugin"
import { fontMono, fontSans } from "@/lib/fonts"

// Taille des écrans en px d'interface (1 unité 3D = 75 px)
export const SCREEN_PX = 75
export const SCREENS = {
  tabs: { w: 4.49, h: 0.67 },
  preview: { w: 4.49, h: 2.95 },
  controls: { w: 4.49, h: 3.8 },
} as const
export type ScreenId = keyof typeof SCREENS

const C = {
  panel: "#1f1f20", // fond du panneau de commandes
  well: "#0c0c0c", // creux (cadrans, fente de l'interrupteur)
  key: "#2e2e30", // touches et boutons
  keyHi: "#3a3a3d",
  line: "#4a4a4d",
  legend: "#a6a6a9", // légendes
  white: "#f2f2f2",
  orange: "#ff3410",
}
const SANS = fontSans.style.fontFamily
const MONO = fontMono.style.fontFamily

// Course des cadrans : de -135° à +135° (0° = en haut)
const SWEEP = 135

export type Action =
  | { type: "mode"; v: PluginState["mode"] }
  | { type: "view"; v: "preview" | "result" }
  | { type: "reset" }
  | { type: "zoomIn" }
  | { type: "zoomOut" }
  | { type: "fit" }
  | { type: "side"; v: PluginState["settings"]["side"] }
  | { type: "alignInside"; v: PluginState["settings"]["alignInside"] }
  | {
      type: "dial"
      key: SliderKey
      min: number
      max: number
      cx: number
      cy: number
    }
  | { type: "figma" }
  | { type: "none" }

type Box = { x: number; y: number; w: number; h: number }
type Pt = { x: number; y: number }
export type Zone = Box & {
  id: string
  action: Action
  draw: (ctx: CanvasRenderingContext2D, hover: boolean) => void
}

// --- petits outils de dessin

function font(weight: number, size: number, family = SANS) {
  return `${weight} ${size}px ${family}`
}

function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  o: {
    color: string
    weight?: number
    size?: number
    family?: string
    align?: CanvasTextAlign
    spacing?: number
  }
) {
  ctx.font = font(o.weight ?? 400, o.size ?? 9, o.family)
  ctx.fillStyle = o.color
  ctx.textAlign = o.align ?? "left"
  ctx.textBaseline = "middle"
  ctx.letterSpacing = `${o.spacing ?? 0}px`
  ctx.fillText(s, x, y)
  ctx.letterSpacing = "0px"
}

function measure(
  ctx: CanvasRenderingContext2D,
  s: string,
  weight: number,
  size: number,
  spacing = 0
) {
  ctx.font = font(weight, size)
  ctx.letterSpacing = `${spacing}px`
  const w = ctx.measureText(s).width
  ctx.letterSpacing = "0px"
  return w
}

function rr(ctx: CanvasRenderingContext2D, b: Box, r: number) {
  ctx.beginPath()
  ctx.roundRect(b.x, b.y, b.w, b.h, r)
}

function dot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string
) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
}

// Touche à plat : un aplat, un ton plus clair au survol, plus sombre une fois enfoncée (mode actif)
function key(
  ctx: CanvasRenderingContext2D,
  b: Box,
  r: number,
  hover: boolean,
  pressed = false
) {
  rr(ctx, b, r)
  ctx.fillStyle = pressed ? C.well : hover ? C.keyHi : C.key
  ctx.fill()
}

// Bouton rond à plat (bouton rotatif, petits boutons)
function knobCap(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  hover: boolean
) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = hover ? C.keyHi : C.key
  ctx.fill()
}

// angle (0° = en haut, sens horaire) → point
function polar(cx: number, cy: number, r: number, deg: number): Pt {
  const a = ((deg - 90) * Math.PI) / 180
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }
}

const noop = { type: "none" } as const

// Élément de décor, non cliquable
function deco(id: string, draw: (ctx: CanvasRenderingContext2D) => void): Zone {
  return { x: 0, y: 0, w: 0, h: 0, id, action: noop, draw }
}

// --- Écran du haut : les trois modes, en touches

export function tabsLayout(
  p: PluginState,
  ctx: CanvasRenderingContext2D
): Zone[] {
  const { w, h } = px("tabs")
  const pad = 9
  const gap = 7
  const bh = 32
  const bw = (w - pad * 2 - gap * 2) / 3
  const modes = [
    ["around", "AROUND"],
    ["inside", "INSIDE"],
    ["outline", "OUTLINE"],
  ] as const
  const zones: Zone[] = [
    deco("bg", (c) => {
      c.fillStyle = C.panel
      c.fillRect(0, 0, w, h)
    }),
  ]
  modes.forEach(([v, label], i) => {
    const b = { x: pad + i * (bw + gap), y: (h - bh) / 2, w: bw, h: bh }
    const on = p.mode === v
    zones.push({
      ...b,
      id: `mode-${v}`,
      action: { type: "mode", v },
      draw: (c, hover) => {
        key(c, b, bh / 2, hover && !on, on)
        const lw = measure(ctx, label, 700, 9, 0.8)
        text(c, label, b.x + (b.w - lw) / 2, b.y + b.h / 2 + 0.5, {
          color: on ? C.white : hover ? "#cfcfd1" : C.legend,
          weight: 700,
          size: 9,
          spacing: 0.8,
        })
      },
    })
  })
  return zones
}

// --- Écran du bas : le panneau de commandes

export function controlsLayout(
  p: PluginState,
  ctx: CanvasRenderingContext2D
): Zone[] {
  const { w, h } = px("controls")
  const pad = 16
  const zones: Zone[] = [
    deco("bg", (c) => {
      c.fillStyle = C.panel
      c.fillRect(0, 0, w, h)
    }),
  ]

  // Rangée du haut : interrupteur preview / result, zoom, reset
  const rowY = 26
  zones.push(...viewSwitch(p, pad, rowY))
  zones.push(...zoomCluster(p, w - pad, rowY))

  // Milieu : deux commandes côte à côte
  const cy = 140
  const left = pad + 76
  const right = w - pad - 76
  if (p.mode === "outline") {
    zones.push(
      ...dial(p, "start", left, cy, "start", p.settings.start, 0, 100, "%")
    )
    zones.push(
      ...dial(
        p,
        "margin",
        right,
        cy,
        p.offsetLabel.toLowerCase(),
        p.margin,
        p.minMargin,
        80,
        "px"
      )
    )
  } else {
    zones.push(
      ...dial(
        p,
        "margin",
        left,
        cy,
        p.offsetLabel.toLowerCase(),
        p.margin,
        p.minMargin,
        80,
        "px"
      )
    )
    if (p.mode === "around")
      zones.push(
        ...selector(
          ctx,
          "side",
          right,
          cy,
          p.settings.side,
          [
            ["left", "left", -60],
            ["all", "both", 0],
            ["right", "right", 60],
          ],
          (v) => ({ type: "side", v })
        )
      )
    else
      zones.push(
        ...selector(
          ctx,
          "align",
          right,
          cy,
          p.settings.alignInside,
          [
            ["left", "left", -75],
            ["center", "center", -25],
            ["right", "right", 25],
            ["justify", "justify", 75],
          ],
          (v) => ({ type: "alignInside", v })
        )
      )
  }

  // Bas : la touche « Test on Figma »
  const fb = { x: pad, y: h - pad - 32, w: w - pad * 2, h: 32 }
  zones.push({
    ...fb,
    id: "figma",
    action: { type: "figma" },
    draw: (c, hover) => {
      // touche sombre, comme les autres touches de l'écran
      key(c, fb, 16, hover)
      const label = "TEST ON FIGMA"
      const tw = measure(ctx, label, 700, 11, 0.8)
      const x0 = fb.x + (fb.w - (9.3 + 8 + tw)) / 2
      figmaLogo(c, x0, fb.y + fb.h / 2 - 7, 14)
      text(c, label, x0 + 9.3 + 8, fb.y + fb.h / 2 + 0.5, {
        color: C.white,
        weight: 700,
        size: 11,
        spacing: 0.8,
      })
    },
  })
  return zones
}

// Interrupteur à glissière : à gauche l'aperçu, à droite le rendu final (un clic le bascule)
function viewSwitch(p: PluginState, x: number, cy: number): Zone[] {
  const slot = { x, y: cy - 9, w: 46, h: 18 }
  const on = p.view === "result"
  return [
    {
      x: slot.x - 4,
      y: slot.y - 6,
      w: slot.w + 8,
      h: slot.h + 12,
      id: "view",
      action: { type: "view", v: on ? "preview" : "result" },
      draw: (c, hover) => {
        rr(c, slot, 9)
        c.fillStyle = C.well
        c.fill()
        const k = {
          x: on ? slot.x + slot.w - 26 : slot.x + 2,
          y: slot.y + 2,
          w: 24,
          h: slot.h - 4,
        }
        key(c, k, 7, hover)
      },
    },
  ]
}

// Zoom : − 100% +, et reset (actif seulement quand on a déplacé quelque chose)
function zoomCluster(p: PluginState, right: number, cy: number): Zone[] {
  const zones: Zone[] = []
  const r = 10
  const button = (
    id: string,
    x: number,
    glyph: string,
    action: Action,
    legend?: string,
    dim = false
  ) => {
    zones.push({
      x: x - r - 3,
      y: cy - r - 3,
      w: (r + 3) * 2,
      h: (r + 3) * 2,
      id,
      action,
      draw: (c, hover) => {
        knobCap(c, x, cy, r, hover && !dim)
        text(c, glyph, x, cy + 0.5, {
          color: dim ? C.line : C.white,
          weight: 600,
          size: 11,
          align: "center",
        })
        if (legend)
          text(c, legend, x, cy + r + 9, {
            color: C.legend,
            size: 8,
            align: "center",
          })
      },
    })
  }
  const xPlus = right - r
  const xRead = xPlus - r - 24
  const xMinus = xRead - 24 - r
  button("zoom-in", xPlus, "+", { type: "zoomIn" })
  zones.push({
    x: xRead - 20,
    y: cy - 9,
    w: 40,
    h: 18,
    id: "zoom-fit",
    action: { type: "fit" },
    draw: (c, hover) => {
      rr(c, { x: xRead - 20, y: cy - 9, w: 40, h: 18 }, 4)
      c.fillStyle = C.well
      c.fill()
      text(c, `${p.zoom}%`, xRead, cy + 0.5, {
        color: hover ? C.white : "#d6d6d8",
        size: 9,
        family: MONO,
        align: "center",
      })
      text(c, "zoom", xRead, cy + r + 9, {
        color: C.legend,
        size: 8,
        align: "center",
      })
    },
  })
  button("zoom-out", xMinus, "−", { type: "zoomOut" })
  button(
    "reset",
    xMinus - r * 2 - 16,
    "↺",
    p.moved ? { type: "reset" } : noop,
    "reset",
    !p.moved
  )
  return zones
}

// Cadran gradué (façon « 180 LAT ») : on le fait tourner en glissant autour.
// La molette orange de l'objet pilote le cadran actif.
function dial(
  p: PluginState,
  k: SliderKey,
  cx: number,
  cy: number,
  label: string,
  value: number,
  min: number,
  max: number,
  unit: string
): Zone[] {
  const R = 56
  const t = (Math.min(max, Math.max(min, value)) - min) / (max - min || 1)
  const ang = -SWEEP + t * SWEEP * 2
  return [
    {
      x: cx - R - 6,
      y: cy - R - 6,
      w: (R + 6) * 2,
      h: (R + 6) * 2,
      id: `dial-${k}`,
      action: { type: "dial", key: k, min, max, cx, cy },
      draw: (c, hover) => {
        // creux noir
        c.beginPath()
        c.arc(cx, cy, R, 0, Math.PI * 2)
        c.fillStyle = C.well
        c.fill()
        c.strokeStyle = hover ? "#3a3a3d" : "#2a2a2c"
        c.lineWidth = 1.5
        c.stroke()
        // graduations : blanches jusqu'à la valeur, grises après
        const n = 40
        for (let i = 0; i <= n; i++) {
          const a = -SWEEP + (i / n) * SWEEP * 2
          const major = i % 5 === 0
          const p1 = polar(cx, cy, R - 6, a)
          const p2 = polar(cx, cy, R - (major ? 15 : 11), a)
          c.beginPath()
          c.moveTo(p1.x, p1.y)
          c.lineTo(p2.x, p2.y)
          c.strokeStyle = a <= ang + 0.01 ? C.white : "#55555a"
          c.lineWidth = major ? 2 : 1.4
          c.lineCap = "round"
          c.stroke()
        }
        // aiguille : petit triangle orange à l'intérieur des graduations
        const tip = polar(cx, cy, R - 18, ang)
        const b1 = polar(cx, cy, R - 28, ang - 8)
        const b2 = polar(cx, cy, R - 28, ang + 8)
        c.beginPath()
        c.moveTo(tip.x, tip.y)
        c.lineTo(b1.x, b1.y)
        c.lineTo(b2.x, b2.y)
        c.closePath()
        c.fillStyle = C.orange
        c.fill()
        // valeur et légende
        text(c, String(value), cx, cy - 2, {
          color: C.white,
          weight: 700,
          size: 21,
          align: "center",
        })
        text(c, `${label} ${unit}`.toUpperCase(), cx, cy + 15, {
          color: C.legend,
          weight: 700,
          size: 8,
          align: "center",
          spacing: 0.6,
        })
      },
    },
  ]
}

// Bouton rotatif à crans : les positions sont écrites autour (on clique dessus),
// et un clic sur le bouton passe à la position suivante
function selector<T extends string>(
  ctx: CanvasRenderingContext2D,
  id: string,
  cx: number,
  cy: number,
  value: T,
  options: readonly (readonly [T, string, number])[],
  action: (v: T) => Action
): Zone[] {
  const R = 30
  const cur = options.find((o) => o[0] === value) ?? options[0]
  const next = options[(options.indexOf(cur) + 1) % options.length]
  const a0 = options[0][2]
  const a1 = options[options.length - 1][2]
  const zones: Zone[] = [
    deco(`${id}-arc`, (c) => {
      // arc fin qui relie les positions, avec un cran à chacune
      c.beginPath()
      c.arc(
        cx,
        cy,
        R + 8,
        ((a0 - 90) * Math.PI) / 180,
        ((a1 - 90) * Math.PI) / 180
      )
      c.strokeStyle = C.line
      c.lineWidth = 1.2
      c.stroke()
      for (const [, , a] of options) {
        const p1 = polar(cx, cy, R + 8, a)
        const p2 = polar(cx, cy, R + 13, a)
        c.beginPath()
        c.moveTo(p1.x, p1.y)
        c.lineTo(p2.x, p2.y)
        c.stroke()
      }
    }),
  ]
  for (const [v, label, a] of options) {
    const on = v === value
    const lp = polar(cx, cy, R + 22, a)
    const lw = measure(ctx, label, 400, 9)
    const align: CanvasTextAlign =
      a < -20 ? "right" : a > 20 ? "left" : "center"
    const bx =
      align === "right" ? lp.x - lw : align === "left" ? lp.x : lp.x - lw / 2
    zones.push({
      x: bx - 6,
      y: lp.y - 9,
      w: lw + 12,
      h: 18,
      id: `${id}-${v}`,
      action: action(v),
      draw: (c, hover) => {
        text(c, label, lp.x, lp.y, {
          color: on || hover ? C.white : C.legend,
          size: 9,
          align,
        })
        if (on) {
          const d = polar(cx, cy, R + 8, a)
          dot(c, d.x, d.y, 2.4, C.orange)
        }
      },
    })
  }
  zones.push({
    x: cx - R,
    y: cy - R,
    w: R * 2,
    h: R * 2,
    id: `${id}-knob`,
    action: action(next[0]),
    draw: (c, hover) => {
      knobCap(c, cx, cy, R, hover)
      // repère blanc qui pointe la position choisie
      const p1 = polar(cx, cy, 7, cur[2])
      const p2 = polar(cx, cy, R - 7, cur[2])
      c.beginPath()
      c.moveTo(p1.x, p1.y)
      c.lineTo(p2.x, p2.y)
      c.strokeStyle = C.white
      c.lineWidth = 3
      c.lineCap = "round"
      c.stroke()
    },
  })
  zones.push(
    deco(`${id}-legend`, (c) =>
      text(c, id.toUpperCase(), cx, cy + R + 26, {
        color: C.legend,
        weight: 700,
        size: 8,
        align: "center",
        spacing: 0.6,
      })
    )
  )
  return zones
}

// Valeur d'un cadran pour un point donné (angle autour du centre, borné à la course)
export function dialValue(
  a: Extract<Action, { type: "dial" }>,
  x: number,
  y: number
) {
  const deg = (Math.atan2(x - a.cx, -(y - a.cy)) * 180) / Math.PI
  const t = (Math.min(SWEEP, Math.max(-SWEEP, deg)) + SWEEP) / (SWEEP * 2)
  return Math.round(a.min + t * (a.max - a.min))
}

// Logo Figma (les cinq formes, couleurs officielles), viewBox 38×57
const FIGMA_PATHS: [string, string][] = [
  ["#1abcfe", "M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z"],
  ["#0acf83", "M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z"],
  ["#ff7262", "M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z"],
  ["#f24e1e", "M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z"],
  ["#a259ff", "M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z"],
]
function figmaLogo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number
) {
  const s = h / 57
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  for (const [fill, d] of FIGMA_PATHS) {
    ctx.fillStyle = fill
    ctx.fill(new Path2D(d))
  }
  ctx.restore()
}

export function px(id: ScreenId) {
  return {
    w: Math.round(SCREENS[id].w * SCREEN_PX),
    h: Math.round(SCREENS[id].h * SCREEN_PX),
  }
}

export function hitZone(zones: Zone[], x: number, y: number) {
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i]
    if (
      z.w > 0 &&
      z.action.type !== "none" &&
      x >= z.x &&
      x <= z.x + z.w &&
      y >= z.y &&
      y <= z.y + z.h
    )
      return z
  }
  return null
}
