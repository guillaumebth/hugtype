"use client"

import { useState } from "react"

import { Lightbox } from "@/components/playground/lightbox"
import { POSTER, SRC } from "@/components/playground/floating-video"

// La vidéo de l'accueil : posée dans le texte, sous le premier paragraphe.
// Un clic l'ouvre en grand.
export function HomeVideo() {
  const [open, setOpen] = useState(false)
  return (
    <figure className="m-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Play the HugType video in full size"
        className="block w-full cursor-zoom-in overflow-hidden bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#222]"
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
      </button>

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
            className="aspect-video"
          />
        </Lightbox>
      )}
    </figure>
  )
}
