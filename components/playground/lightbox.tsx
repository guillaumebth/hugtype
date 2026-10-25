"use client"

import { useEffect } from "react"

// Ouvre un élément en grand, fond flouté. Échap ou clic à côté pour fermer.
export function Lightbox({
  label,
  onClose,
  children,
}: {
  label: string
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
      className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/50 backdrop-blur-xl duration-300 fade-in"
    >
      <div onClick={(e) => e.stopPropagation()} className="animate-in duration-300 zoom-in-95">
        {children}
      </div>
    </div>
  )
}
