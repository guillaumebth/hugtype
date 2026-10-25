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
  onFront,
}: {
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
          "fixed w-40 cursor-grab touch-none overflow-hidden border border-white/15 bg-black shadow-[0_10px_30px_rgba(0,0,0,0.5)] select-none hover:border-white/40 focus-visible:border-white focus-visible:outline-none active:cursor-grabbing md:w-60 " +
          (left == null ? "right-4 bottom-4" : "")
        }
      >
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
