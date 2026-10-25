// Petits éléments du panneau, dans le style exact du plugin (ui.html)

import { cn } from "@/lib/utils"

export function Label({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between font-semibold">
      <div>{children}</div>
      {aside != null && <span className="font-normal text-[#8c8c8c]">{aside}</span>}
    </div>
  )
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
  cols,
  full,
}: {
  value: T
  options: { v: T; label: string }[]
  onChange: (v: T) => void
  cols: 2 | 3 | 4 | 5
  full?: T
}) {
  return (
    <div
      className={cn(
        "grid gap-0.5 rounded-md bg-[#1e1e1e] p-0.5",
        { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" }[cols]
      )}
    >
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "cursor-pointer rounded-[4px] px-1 py-[5px] text-[#8c8c8c] transition-colors hover:text-white",
            o.v === value && "bg-[#2a2a2a] font-medium text-white shadow-[inset_0_0_0_1px_#2e2e2e]",
            o.v === full && "col-span-full"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  number,
  label,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  number?: boolean
  label: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={Math.min(max, value)}
        onChange={(e) => onChange(+e.target.value)}
        className="flex-1 accent-white"
      />
      {number && (
        <input
          type="number"
          aria-label={label}
          min={min}
          max={500}
          step={step}
          value={value}
          onChange={(e) => onChange(Math.max(min, +e.target.value || 0))}
          className="w-14 rounded-[5px] border border-transparent bg-[#1e1e1e] px-1.5 py-1 text-white hover:border-[#2e2e2e] focus:border-[#8c8c8c] focus:outline-none"
        />
      )}
    </div>
  )
}

export function Desc({ children }: { children: React.ReactNode }) {
  return <div className="mt-1.5 text-[#8c8c8c]">{children}</div>
}
