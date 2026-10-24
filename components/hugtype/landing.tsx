"use client"

import { useEffect, useRef, useState } from "react"

import { Desk } from "@/components/hugtype/desk"
import { HeartLogo } from "@/components/hugtype/heart-logo"
import { PaperCanvas } from "@/components/hugtype/paper-canvas"
import { createScene, setBlocks } from "@/components/hugtype/scene"
import { SheetStack } from "@/components/hugtype/sheet-stack"
import { SheetViewer } from "@/components/hugtype/sheet-viewer"
import { useMediaQuery } from "@/hooks/use-media-query"
import { FIGMA_URL, SHEETS } from "@/lib/site"

export function Landing() {
  const [scene] = useState(createScene)
  const [openId, setOpenId] = useState<string | null>(null)
  const [tidySignal, setTidySignal] = useState(0)
  const [stackTop, setStackTop] = useState(260)
  const isMobile = useMediaQuery("(max-width: 767px)")
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const headerRef = useRef<HTMLElement>(null)

  // Le texte de fond contourne chaque élément du titre
  useEffect(() => {
    const header = headerRef.current
    if (!header) return
    function measure() {
      if (!header) return
      const items = header.querySelectorAll<HTMLElement>("[data-hug]")
      setBlocks(
        scene,
        [...items].map((el) => {
          const r = el.getBoundingClientRect()
          return { x: r.left, y: r.top, w: r.width, h: r.height }
        })
      )
      setStackTop(header.getBoundingClientRect().bottom + 12)
    }
    measure()
    document.fonts.ready.then(measure)
    const ro = new ResizeObserver(measure)
    ro.observe(header)
    window.addEventListener("resize", measure)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [scene])

  const openSheet = SHEETS.find((s) => s.id === openId)
  const ready = isMobile !== null && reducedMotion !== null

  return (
    <main className="relative h-svh touch-none overflow-hidden bg-black text-white">
      {ready && <PaperCanvas scene={scene} sheets={SHEETS} />}

      {ready &&
        (isMobile ? (
          <SheetStack
            scene={scene}
            sheets={SHEETS}
            top={stackTop}
            reducedMotion={reducedMotion}
            onOpen={setOpenId}
          />
        ) : (
          <Desk
            scene={scene}
            sheets={SHEETS}
            reducedMotion={reducedMotion}
            tidySignal={tidySignal}
            onOpen={setOpenId}
          />
        ))}

      <header
        ref={headerRef}
        className="pointer-events-none relative z-20 mx-auto flex max-w-xl flex-col items-center px-4 pt-6 text-center md:pt-10"
      >
        <p data-hug className="font-heading text-[11px] font-bold tracking-tight uppercase">
          HugType
        </p>
        <h1
          data-hug
          className="mt-5 font-heading text-[clamp(1.2rem,1.52vw,1.8rem)] leading-[1.05] font-bold tracking-tight text-balance uppercase md:mt-6 md:whitespace-nowrap"
        >
          Make your text{" "}
          <HeartLogo className="mx-0.5 inline-block h-[0.78em] w-auto -translate-y-[0.06em] align-baseline" />{" "}
          hug anything.
        </h1>
        <p
          data-hug
          className="mt-3 max-w-[17.6rem] font-heading text-[10.5px] leading-snug font-medium uppercase md:mt-4"
        >
          A free Figma plugin to wrap text around, inside or along any cutout image.
        </p>
        <a
          data-hug
          href={FIGMA_URL}
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto mt-4 rounded-full bg-white px-3 py-1.5 font-heading text-[9.5px] font-semibold tracking-tight text-black uppercase transition-colors duration-200 hover:bg-neutral-300 focus-visible:bg-neutral-300 focus-visible:outline-none"
        >
          Get it free on Figma
        </a>
        <p data-hug className="mt-2.5 font-mono text-[8px] tracking-wider text-white/60 uppercase">
          Free for Figma Community · V1
        </p>
      </header>

      <a
        href="https://guillaume.info"
        target="_blank"
        rel="noreferrer"
        className="absolute top-4 right-4 z-20 font-mono text-[10px] tracking-wider text-white/60 uppercase transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none"
      >
        Built by guillaume.info
      </a>

      {ready && !isMobile && (
        <button
          type="button"
          onClick={() => setTidySignal((n) => n + 1)}
          className="absolute right-4 bottom-4 z-20 rounded-full bg-neutral-800 px-3 py-1.5 font-mono text-[11px] tracking-wider text-white uppercase transition-colors hover:bg-neutral-700 focus-visible:bg-neutral-700 focus-visible:outline-none"
        >
          Tidy up
        </button>
      )}

      {ready && isMobile && (
        <p className="pointer-events-none absolute inset-x-0 bottom-4 z-20 text-center font-mono text-[10px] tracking-wider text-white/60 uppercase">
          Swipe · Tap to open
        </p>
      )}

      {openSheet && <SheetViewer sheet={openSheet} onClose={() => setOpenId(null)} />}
    </main>
  )
}
