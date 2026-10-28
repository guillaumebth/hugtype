"use client"

import { useEffect, useRef } from "react"

import {
  createPreviewController,
  type PreviewProps,
  type ZoomApi,
} from "@/lib/hugtype/preview-controller"

export type { ZoomApi }

// Interactions reprises de ui.html : glisser l'objet ou le texte, tirer les poignées,
// zoom (Ctrl/Cmd + molette, boutons), molette pour se déplacer, double-clic pour recadrer
export function PluginPreview({
  zoomRef,
  ...props
}: PreviewProps & { zoomRef: React.RefObject<ZoomApi | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctrl = useRef<ReturnType<typeof createPreviewController> | null>(null)
  const spaceDown = useRef(false)

  function draw() {
    const cv = canvasRef.current
    const ctx = cv?.getContext("2d")
    const c = ctrl.current
    if (!cv || !ctx || !c) return
    const r = cv.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    if (
      cv.width !== Math.round(r.width * dpr) ||
      cv.height !== Math.round(r.height * dpr)
    ) {
      cv.width = Math.round(r.width * dpr)
      cv.height = Math.round(r.height * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    c.draw(ctx)
  }

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    if (!ctrl.current) {
      ctrl.current = createPreviewController(draw)
      const r = cv.getBoundingClientRect()
      ctrl.current.setSize(r.width, r.height)
    }
    ctrl.current.setProps(props)
    draw()
  })

  useEffect(() => {
    const cv = canvasRef.current
    const c = ctrl.current
    if (!cv || !c) return
    zoomRef.current = c.zoom

    function pt(e: PointerEvent | MouseEvent) {
      const r = cv!.getBoundingClientRect()
      return {
        sx: e.clientX - r.left,
        sy: e.clientY - r.top,
        touch: "pointerType" in e && e.pointerType !== "mouse",
        shiftKey: e.shiftKey,
      }
    }
    function updateCursor() {
      cv!.style.cursor = c!.cursor(spaceDown.current)
    }

    function onDown(e: PointerEvent) {
      c!.down({ ...pt(e), pan: spaceDown.current || e.button === 1 })
      cv!.setPointerCapture(e.pointerId)
      updateCursor()
    }
    function onMove(e: PointerEvent) {
      c!.move(pt(e))
      updateCursor()
    }
    function onUp() {
      c!.up()
      updateCursor()
    }
    function onLeave() {
      c!.leave()
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const p = pt(e)
      c!.wheel({
        sx: p.sx,
        sy: p.sy,
        dx: e.deltaX,
        dy: e.deltaY,
        zoom: e.ctrlKey || e.metaKey,
      })
    }
    function onDbl() {
      c!.zoom.fit()
    }
    function onKey(e: KeyboardEvent) {
      const typing = /INPUT|TEXTAREA|SELECT/.test(
        (document.activeElement as HTMLElement | null)?.tagName ?? ""
      )
      if (e.code !== "Space" || typing) return
      if (e.type === "keydown" && !spaceDown.current) {
        spaceDown.current = true
        e.preventDefault()
      } else if (e.type === "keyup") spaceDown.current = false
      updateCursor()
    }

    const ro = new ResizeObserver(() => {
      const r = cv.getBoundingClientRect()
      c.setSize(r.width, r.height)
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
