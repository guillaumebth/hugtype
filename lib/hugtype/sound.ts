// Les sons de l'objet 3D, générés dans le navigateur (Web Audio, aucun fichier) :
// un tic sec à chaque cran (molette, cadran), et des clics de touche sur l'écran des commandes.

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

// un petit éclat de bruit filtré : le « clic » lui-même
function burst(
  a: AudioContext,
  t: number,
  freq: number,
  q: number,
  gain: number,
  dur: number
) {
  const src = a.createBufferSource()
  src.buffer = noise
  const f = a.createBiquadFilter()
  f.type = "bandpass"
  f.frequency.value = freq
  f.Q.value = q
  const g = a.createGain()
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(a.destination)
  src.start(t, Math.random() * 0.5, dur + 0.02)
}

// une petite note boisée qui retombe très vite : le « tock » d'une touche
function tock(
  a: AudioContext,
  t: number,
  from: number,
  to: number,
  gain: number,
  dur: number
) {
  const o = a.createOscillator()
  o.type = "triangle"
  o.frequency.setValueAtTime(from, t)
  o.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

// Touche enfoncée : une attaque aiguë très brève + un « tock » court et net
export function press() {
  const a = audio()
  if (!a || !noise) return
  const t = a.currentTime + 0.005
  const v = 0.95 + Math.random() * 0.1
  burst(a, t, 4800 * v, 3, 0.1, 0.006)
  tock(a, t, 1500 * v, 650 * v, 0.14, 0.035)
}

// Touche relâchée : un tic plus léger et plus aigu
export function release() {
  const a = audio()
  if (!a || !noise) return
  const t = a.currentTime + 0.005
  const v = 0.95 + Math.random() * 0.1
  burst(a, t, 6000 * v, 3, 0.06, 0.005)
  tock(a, t, 2200 * v, 1400 * v, 0.05, 0.018)
}

// Interrupteur à glissière : deux petits « tock » rapprochés
export function slide() {
  const a = audio()
  if (!a || !noise) return
  const t = a.currentTime + 0.005
  const v = 0.95 + Math.random() * 0.1
  burst(a, t, 4800 * v, 3, 0.08, 0.006)
  tock(a, t, 1300 * v, 700 * v, 0.1, 0.03)
  burst(a, t + 0.035, 4200 * v, 3, 0.07, 0.006)
  tock(a, t + 0.035, 1000 * v, 550 * v, 0.1, 0.035)
}
