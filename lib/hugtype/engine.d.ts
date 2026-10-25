// Types for engine.js (the plugin's own algorithms, kept in plain JS)

export type Word = { k: string; s: number; e: number; sep: number }

export type Mask = {
  x: number
  y: number
  w: number
  h: number
  iw: number
  ih: number
  left: Int16Array
  right: Int16Array
}

export type Settings = {
  mode: "around" | "inside" | "outline"
  side: "left" | "right" | "all"
  margin: number
  align: "contour" | "left" | "center" | "right" | "justify"
  alignInside: "left" | "center" | "right" | "justify"
  threshold: number
  smooth: number
  start: number
  pathFit: "natural" | "fit"
  pathSide: "out" | "in"
  hideObj: boolean
}

export type Line = {
  words: Word[]
  y: number
  x: number
  xs: number[]
  gapExtra: number
}

export type LayoutResult = { lines: Line[]; remaining: number; height: number }

export function layout(p: {
  paras: Word[][]
  W: number
  maxH: number | null
  lh: number
  fontSize: number
  masks: Mask[]
  settings: Settings
  wordW: (w: Word) => number
  spaceW: number
}): LayoutResult

export type Alpha = { w: number; h: number; a: Uint8Array }

export type OutlinePath = {
  pts: [number, number][]
  N: number
  dense: { x: number; y: number; d: number }[]
  segStart: number[]
  length: number
  d: string
  ox: number
  oy: number
}

export function outlinePath(
  objs: { x: number; y: number; w: number; h: number; al: Alpha }[],
  opts: { margin: number; smooth: number; threshold: number; inward: boolean }
): OutlinePath | null

export function pointAt(path: OutlinePath, s: number): { x: number; y: number; ang: number }
