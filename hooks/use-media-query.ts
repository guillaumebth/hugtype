"use client"

import { useSyncExternalStore } from "react"

// Renvoie null côté serveur (on ne connaît pas encore l'écran), puis true / false
export function useMediaQuery(query: string): boolean | null {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query)
      mq.addEventListener("change", onChange)
      return () => mq.removeEventListener("change", onChange)
    },
    () => window.matchMedia(query).matches,
    () => null
  )
}
