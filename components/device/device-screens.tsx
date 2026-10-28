"use client"

import { createPortal, useFrame, type ThreeEvent } from "@react-three/fiber"
import { Fragment, useEffect, useRef } from "react"
import * as THREE from "three"

import {
  controlsLayout,
  hitZone,
  px,
  SCREENS,
  dialValue,
  tabsLayout,
  type Action,
  type ScreenId,
  type Zone,
} from "@/components/device/screen-ui"
import { FONT, type PluginState } from "@/components/playground/use-plugin"
import {
  createPreviewController,
  type PreviewController,
} from "@/lib/hugtype/preview-controller"
import { FIGMA_URL } from "@/lib/site"

// Résolution des textures : 3 pixels de texture par px d'interface (net même en grand)
const RES = 3
// luminosité des écrans allumés
const SCREEN_GAIN = 1.3
const IDS: ScreenId[] = ["tabs", "preview", "controls"]
const NODE: Record<ScreenId, string> = {
  tabs: "Screen_Tabs",
  preview: "Screen_Preview",
  controls: "Screen_Controls",
}

type Surface = {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  tex: THREE.CanvasTexture
  mat: THREE.MeshBasicMaterial
  zones: Zone[]
}

// Les trois écrans : l'interface est dessinée dans une texture qui « éclaire » la vitre de l'écran
export function DeviceScreens({
  p,
  scene,
  power,
  interactive,
  setCursor,
}: {
  p: PluginState
  scene: THREE.Object3D
  // 0 = éteint, 1 = allumé (suit l'ouverture du clapet)
  power: React.RefObject<number>
  interactive: boolean
  setCursor: (c: string | null) => void
}) {
  const surfaces = useRef<Record<ScreenId, Surface> | null>(null)
  const preview = useRef<PreviewController | null>(null)
  const hover = useRef<{ screen: ScreenId; id: string } | null>(null)
  const drag = useRef<{
    screen: ScreenId
    zone?: Zone
    pointerId: number
  } | null>(null)
  const latest = useRef(p)

  // Allumage : la luminosité suit l'ouverture
  useFrame(() => {
    const s = surfaces.current
    if (!s) return
    // un peu plus lumineux que 1 : compense le rendu final, qui ternit les blancs
    for (const id of IDS) s[id].mat.color.setScalar(power.current * SCREEN_GAIN)
  })

  function begin(id: ScreenId) {
    const s = surfaces.current![id]
    const { w, h } = px(id)
    s.ctx.setTransform(RES, 0, 0, RES, 0, 0)
    s.ctx.clearRect(0, 0, w, h)
    return s
  }

  function drawZones(id: ScreenId, zones: Zone[]) {
    const s = begin(id)
    const { w, h } = px(id)
    s.ctx.fillStyle = "#000"
    s.ctx.fillRect(0, 0, w, h)
    s.zones = zones
    for (const z of zones)
      z.draw(s.ctx, hover.current?.screen === id && hover.current.id === z.id)
    s.tex.needsUpdate = true
  }

  function drawPreview() {
    const s = surfaces.current
    const c = preview.current
    if (!s || !c) return
    const ctx = begin("preview").ctx
    const { w, h } = px("preview")
    c.draw(ctx)
    // fond de l'aperçu sous le dessin (drawPreview efface le canvas)
    ctx.globalCompositeOperation = "destination-over"
    ctx.fillStyle = "#111"
    ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = "source-over"
    s.preview.tex.needsUpdate = true
  }

  function drawAll() {
    const s = surfaces.current
    if (!s) return
    const st = latest.current
    drawZones("tabs", tabsLayout(st, s.tabs.ctx))
    drawZones("controls", controlsLayout(st, s.controls.ctx))
    const c = preview.current
    if (c && st.comp && st.mask && st.metrics && st.cutout) {
      c.setProps({
        mask: st.mask,
        col: { ...st.col, h: st.colH },
        mode: st.mode,
        metrics: st.metrics,
        comp: st.comp,
        font: FONT,
        result: st.view === "result" ? st.cutout.img : null,
        hint: st.hint,
        onObj: st.moveObj,
        onCol: st.moveCol,
        onZoom: st.setZoom,
      })
      drawPreview()
    }
  }

  // Création des textures et des matériaux (une seule fois)
  useEffect(() => {
    const s = {} as Record<ScreenId, Surface>
    for (const id of IDS) {
      const { w, h } = px(id)
      const canvas = document.createElement("canvas")
      canvas.width = w * RES
      canvas.height = h * RES
      const ctx = canvas.getContext("2d")!
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.flipY = false // les UV du glTF ont leur origine en haut à gauche
      tex.anisotropy = 8
      // dalle lumineuse : affiche la texture telle quelle (pas de reflet → le noir reste noir)
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        color: "#000",
        toneMapped: false,
      })
      const mesh = scene.getObjectByName(NODE[id])
      if (mesh instanceof THREE.Mesh) mesh.material = mat
      s[id] = { canvas, ctx, tex, mat, zones: [] }
    }
    surfaces.current = s
    // dans l'écran de l'objet, l'aperçu démarre à 80 % pour laisser de l'air autour
    preview.current = createPreviewController(() => drawPreview(), {
      fitZoom: 0.8,
    })
    preview.current.setSize(px("preview").w, px("preview").h)
    latest.current.zoomRef.current = preview.current.zoom
    drawAll()
    document.fonts.ready.then(() => drawAll())
    return () => {
      for (const id of IDS) {
        s[id].tex.dispose()
        s[id].mat.dispose()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  // À chaque changement d'état du plugin, on redessine les écrans
  useEffect(() => {
    latest.current = p
    drawAll()
  })

  function run(a: Action, pt: { x: number; y: number }) {
    const st = latest.current
    switch (a.type) {
      case "mode":
        return st.set("mode", a.v)
      case "view":
        return st.setView(a.v)
      case "reset":
        return st.reset()
      case "zoomIn":
        return preview.current?.zoom.zoomIn()
      case "zoomOut":
        return preview.current?.zoom.zoomOut()
      case "fit":
        return preview.current?.zoom.fit()
      case "side":
        return st.set("side", a.v)
      case "alignInside":
        return st.set("alignInside", a.v)
      case "dial":
        return st.set(a.key, dialValue(a, pt.x, pt.y))
      case "figma":
        window.open(FIGMA_URL, "_blank", "noopener,noreferrer")
    }
  }

  // Point touché sur l'écran, en px d'interface. On passe par le plan de l'écran
  // (et pas par l'UV) pour que le glisser continue même si le pointeur sort de l'écran.
  function toScreen(
    id: ScreenId,
    e: ThreeEvent<PointerEvent | MouseEvent | WheelEvent>
  ) {
    const mesh = scene.getObjectByName(NODE[id])!
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(
      mesh.matrixWorld
    )
    const origin = new THREE.Vector3(0, 0, -0.022).applyMatrix4(
      mesh.matrixWorld
    )
    const hit = e.ray.intersectPlane(
      new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin),
      new THREE.Vector3()
    )
    if (!hit) return null
    const local = mesh.worldToLocal(hit)
    const { w, h } = SCREENS[id]
    const size = px(id)
    return { x: (local.x / w + 0.5) * size.w, y: (0.5 - local.y / h) * size.h }
  }

  function setHover(id: ScreenId, zone: Zone | null) {
    const prev = hover.current
    const next = zone ? { screen: id, id: zone.id } : null
    if (prev?.screen === next?.screen && prev?.id === next?.id) return
    hover.current = next
    if (prev && prev.screen !== id) redraw(prev.screen)
    redraw(id)
  }
  function redraw(id: ScreenId) {
    const st = latest.current
    const s = surfaces.current
    if (!s) return
    if (id === "tabs") drawZones("tabs", tabsLayout(st, s.tabs.ctx))
    if (id === "controls")
      drawZones("controls", controlsLayout(st, s.controls.ctx))
  }

  function handlers(id: ScreenId) {
    return {
      onPointerDown(e: ThreeEvent<PointerEvent>) {
        if (!interactive) return
        e.stopPropagation()
        const pt = toScreen(id, e)
        if (!pt) return
        ;(e.target as Element).setPointerCapture(e.pointerId)
        if (id === "preview") {
          preview.current?.down({
            sx: pt.x,
            sy: pt.y,
            touch: e.pointerType !== "mouse",
            pan: e.button === 1,
          })
          drag.current = { screen: id, pointerId: e.pointerId }
          setCursor(preview.current?.cursor() ?? null)
          return
        }
        const zone = hitZone(surfaces.current![id].zones, pt.x, pt.y)
        if (!zone) return
        drag.current = { screen: id, zone, pointerId: e.pointerId }
        run(zone.action, pt)
      },
      onPointerMove(e: ThreeEvent<PointerEvent>) {
        if (!interactive) return
        const d = drag.current
        // pendant un glisser, seul l'écran qui l'a commencé réagit
        if (d && d.screen !== id) return
        e.stopPropagation()
        const pt = toScreen(id, e)
        if (!pt) return
        if (id === "preview") {
          preview.current?.move({
            sx: pt.x,
            sy: pt.y,
            touch: e.pointerType !== "mouse",
            shiftKey: e.shiftKey,
          })
          setCursor(preview.current?.cursor() ?? null)
          return
        }
        if (d?.zone?.action.type === "dial") {
          run(d.zone.action, pt)
          return
        }
        const zone = hitZone(surfaces.current![id].zones, pt.x, pt.y)
        setHover(id, zone)
        setCursor(zone ? "pointer" : null)
      },
      onPointerUp(e: ThreeEvent<PointerEvent>) {
        const d = drag.current
        if (!d || d.screen !== id) return
        e.stopPropagation()
        ;(e.target as Element).releasePointerCapture(e.pointerId)
        drag.current = null
        if (id === "preview") {
          preview.current?.up()
          setCursor(preview.current?.cursor() ?? null)
        }
      },
      onPointerLeave() {
        if (drag.current) return
        if (id === "preview") preview.current?.leave()
        else setHover(id, null)
        setCursor(null)
      },
      onWheel(e: ThreeEvent<WheelEvent>) {
        if (!interactive || id !== "preview") return
        e.stopPropagation()
        const pt = toScreen(id, e)
        if (!pt) return
        preview.current?.wheel({
          sx: pt.x,
          sy: pt.y,
          dx: e.deltaX,
          dy: e.deltaY,
          zoom: e.ctrlKey || e.metaKey,
        })
      },
      onDoubleClick(e: ThreeEvent<MouseEvent>) {
        if (!interactive || id !== "preview") return
        e.stopPropagation()
        preview.current?.zoom.fit()
      },
    }
  }

  return (
    <>
      {IDS.map((id) => {
        const node = scene.getObjectByName(NODE[id])
        if (!node) return null
        // zone de clic posée sur la vitre (invisible)
        return (
          <Fragment key={id}>
            {createPortal(
              <mesh position={[0, 0, -0.02]} {...handlers(id)}>
                <planeGeometry args={[SCREENS[id].w, SCREENS[id].h]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>,
              node
            )}
          </Fragment>
        )
      })}
    </>
  )
}
