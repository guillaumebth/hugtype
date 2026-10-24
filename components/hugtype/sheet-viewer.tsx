"use client"

import Image from "next/image"
import { useEffect, useRef } from "react"

import type { Sheet } from "@/lib/site"

export function SheetViewer({ sheet, onClose }: { sheet: Sheet; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      previous?.focus()
    }
  }, [onClose])

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label={sheet.title}
      onClick={onClose}
      className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/50 backdrop-blur-xl duration-300 fade-in outline-none"
    >
      <Image
        src={sheet.src}
        alt={sheet.title}
        width={sheet.width}
        height={sheet.height}
        sizes="100vw"
        onClick={(e) => e.stopPropagation()}
        // la feuille prend le plus de place possible sans être coupée
        style={{ width: `min(84vw, calc(82svh * ${sheet.width / sheet.height}))` }}
        className="h-auto animate-in object-contain shadow-[0_16px_48px_rgba(0,0,0,0.3)] duration-300 zoom-in-95"
      />
    </div>
  )
}
