"use client"

import { useState } from "react"

import { Lightbox } from "@/components/playground/lightbox"
import { useFloating } from "@/hooks/use-floating"

const SRC = "/video/hugtype.mp4"
const POSTER = "/video/hugtype-poster.jpg"

export const VIDEO_W = 240
export const VIDEO_H = 135

// Petite vidéo flottante : on peut la déplacer, et un clic l'ouvre en grand.
// Avec `place`, elle est posée parmi les feuilles ; sinon, en bas à droite (mobile).
export function FloatingVideo({
  place,
  z = 0,
  flat,
  caption,
  onFront,
}: {
  flat?: boolean
  caption?: { n: string; title: string }
  place?: { x: number; y: number; rot: number }
  z?: number
  onFront?: () => void
}) {
  const [open, setOpen] = useState(false)
  const { ref, pos, handlers } = useFloating(() => setOpen(true))
  const left = pos?.x ?? place?.x
  const top = pos?.y ?? place?.y

  return (
    <>
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        aria-label="Play the HugType video in full size"
        {...handlers}
        onPointerDown={(e) => {
          onFront?.()
          handlers.onPointerDown(e)
        }}
        style={{
          left,
          top,
          zIndex: 20 + z,
          rotate: place ? `${place.rot}deg` : undefined,
        }}
        className={
          "fixed w-40 cursor-grab touch-none select-none focus-visible:outline-none active:cursor-grabbing md:w-60 " +
          (flat
            ? "focus-visible:outline-2 focus-visible:outline-[#222] "
            : "border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:border-white/40 focus-visible:border-white ") +
          (left == null ? "right-4 bottom-4" : "")
        }
      >
        <div className="overflow-hidden bg-black">
          <video
            src={SRC}
            poster={POSTER}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="pointer-events-none block aspect-video w-full"
          />
        </div>
        {caption && (
          <div className="pointer-events-none absolute top-full left-0 mt-1.5 text-[10px] leading-tight whitespace-nowrap text-[#444]">
            <span className="font-mono text-[#6b6b6b]">{caption.n}</span>{" "}
            {caption.title}
          </div>
        )}
      </div>

      {open && (
        <Lightbox label="HugType video" onClose={() => setOpen(false)}>
          <video
            src={SRC}
            poster={POSTER}
            autoPlay
            muted
            loop
            playsInline
            style={{ width: "min(84vw, calc(82svh * 16 / 9))" }}
            className="aspect-video shadow-[0_16px_48px_rgba(0,0,0,0.3)]"
          />
        </Lightbox>
      )}
    </>
  )
}
