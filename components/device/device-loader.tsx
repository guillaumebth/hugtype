// Pendant le chargement de l'objet 3D (modèle, studio, effets) : un petit afficheur
// façon appareil, avec le pourcentage et une barre fine. Il s'efface quand l'objet est prêt.
export function DeviceLoader({
  progress,
  done = false,
}: {
  progress: number
  done?: boolean
}) {
  const pct = Math.round(Math.min(100, Math.max(0, progress)))
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-500"
      style={{ opacity: done ? 0 : 1 }}
    >
      <div className="flex w-[148px] flex-col gap-2">
        <div className="flex justify-between font-mono text-[10px] tracking-wider text-[#1a1a1a]/80 uppercase">
          <span>Loading</span>
          <span>{String(pct).padStart(3, "0")}%</span>
        </div>
        <div className="h-px w-full bg-black/15">
          <div
            className="h-px bg-[#1a1a1a] transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
