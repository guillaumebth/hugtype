import { HeartLogo } from "@/components/hugtype/heart-logo"
import { PluginPanel } from "@/components/playground/plugin-panel"

export function Home() {
  return (
    <div className="flex h-svh flex-col overflow-hidden bg-black text-white">
      <header className="mx-auto flex max-w-xl shrink-0 flex-col items-center px-4 pt-6 text-center md:pt-8">
        <p className="text-[11px] font-bold tracking-tight uppercase">HugType</p>
        <h1 className="mt-5 text-[clamp(1.2rem,1.52vw,1.8rem)] leading-[1.05] font-bold tracking-tight text-balance uppercase md:mt-6 md:whitespace-nowrap">
          Make your text{" "}
          <HeartLogo className="mx-0.5 inline-block h-[0.78em] w-auto -translate-y-[0.06em] align-baseline" />{" "}
          hug anything.
        </h1>
        <p className="mt-3 max-w-[17.6rem] text-[10.5px] leading-snug font-medium uppercase md:mt-4">
          A free Figma plugin to wrap text around, inside or along any cutout image. Try it right here.
        </p>
        <p className="mt-3 font-mono text-[8px] tracking-wider text-white/60 uppercase">
          Native, editable text · Your original is kept
        </p>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center px-4 pt-[min(3rem,4svh)] pb-3">
        <div className="min-h-0 w-full max-w-[340px] flex-1 max-h-[500px]">
          <PluginPanel />
        </div>
      </main>

      <footer className="flex shrink-0 justify-center px-4 py-3">
        <a
          href="https://www.bguillaume.info"
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[10px] tracking-wider text-white/60 uppercase transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none"
        >
          Built by bguillaume.info
        </a>
      </footer>
    </div>
  )
}
