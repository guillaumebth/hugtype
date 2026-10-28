// Le son de la molette de l'objet 3D, généré dans le navigateur (Web Audio, aucun fichier) :
// un petit tic sec à chaque cran, comme une molette crantée.

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null
let lastTick = 0

// Le navigateur n'autorise le son qu'après une action de la personne (clic, touche) :
// avant ça, on ne joue rien.
let unlocked = false
if (typeof window !== "undefined") {
  const unlock = () => {
    unlocked = true
    window.removeEventListener("pointerdown", unlock, true)
    window.removeEventListener("keydown", unlock, true)
  }
  window.addEventListener("pointerdown", unlock, true)
  window.addEventListener("keydown", unlock, true)
}

function audio() {
  if (typeof window === "undefined" || !unlocked) return null
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    // une seconde de bruit blanc, réutilisée pour tous les tics
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

// Un cran de molette : un éclat de bruit très court, filtré dans les aigus
export function tick() {
  const a = audio()
  if (!a || !noise) return
  // pas plus d'un tic toutes les 25 ms, même si la valeur saute de plusieurs crans
  const now = performance.now()
  if (now - lastTick < 25) return
  lastTick = now
  const t = a.currentTime + 0.005
  // petite variation à chaque cran, pour que ça sonne « physique » et pas répétitif
  const v = 0.92 + Math.random() * 0.16
  const src = a.createBufferSource()
  src.buffer = noise
  const f = a.createBiquadFilter()
  f.type = "bandpass"
  f.frequency.value = 5200 * v
  f.Q.value = 2.5
  const g = a.createGain()
  g.gain.setValueAtTime(0.16, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.008)
  src.connect(f).connect(g).connect(a.destination)
  src.start(t, Math.random() * 0.5, 0.03)
}
