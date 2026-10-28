"use client"

import {
  Canvas,
  createPortal,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber"
import { Environment, useGLTF, useProgress } from "@react-three/drei"
import { EffectComposer, N8AO, ToneMapping } from "@react-three/postprocessing"
import { ToneMappingMode } from "postprocessing"
import { useEffect, useRef, useState } from "react"
import * as THREE from "three"

import { DeviceLoader } from "@/components/device/device-loader"
import { DeviceScreens } from "@/components/device/device-screens"
import type { PluginState } from "@/components/playground/use-plugin"
import { tick } from "@/lib/hugtype/sound"

const MODEL = "/models/hugtype-device.glb"
// le modèle est compressé (Draco) : le décodeur est servi par le site lui-même
const DRACO = "/draco/"

// Dimensions de l'objet (en unités Blender, cf. blender/hugtype-device.blend)
const OPEN_H = 8.6
const OPEN_W = 5.3
// hauteur cadrée quand l'objet est fermé : bien plus que sa taille réelle (≈ 4.4), pour qu'il reste petit
const CLOSED_H = 8.2
const BOTTOM_CENTER = -2.175

// Un cran de molette = une dent (48 dents) = 1 px de réglage
const TOOTH = (Math.PI * 2) / 48
const DRAG_PX_PER_STEP = 6

const OPEN_MS = 1500

// L'orange de l'objet : dos en similicuir, molette, pastille du slider relié à la molette
export const ORANGE = "#ff3410"
// Teinte de la matière 3D : plus sombre que ORANGE, car la lumière l'éclaircit.
// Réglée pour que l'objet affiché à l'écran retombe sur #FF3410 (et pas sur un saumon délavé).
const ORANGE_ALBEDO = "#e02a07"

type Phase = "closed" | "opening" | "open" | "closing"

export function DeviceScene({
  p,
  open,
  onOpenChange,
  onScreensOn,
  focus = false,
}: {
  p: PluginState
  open: boolean
  onOpenChange: (open: boolean) => void
  onScreensOn: (on: boolean) => void
  // plein écran sur téléphone : l'objet est cadré au plus près
  focus?: boolean
}) {
  // l'objet est chargé et affiché : on retire l'écran de chargement
  const [ready, setReady] = useState(false)
  const { progress } = useProgress()

  return (
    <div className="relative size-full">
      <Canvas
        dpr={[1, 2]}
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{ fov: 28, position: [0, 0, 20], near: 0.1, far: 100 }}
        // rendu « neutre » : garde les couleurs saturées (l'orange) telles quelles
        gl={{
          antialias: true,
          toneMapping: THREE.NeutralToneMapping,
          toneMappingExposure: 1,
        }}
      >
        <Studio />
        <Device
          p={p}
          open={open}
          onOpenChange={onOpenChange}
          onScreensOn={onScreensOn}
          onReady={() => setReady(true)}
          focus={focus}
        />
        {/* occlusion ambiante : assombrit les creux (écrans encastrés, charnière, fente de la molette),
          puis rendu « neutre » qui garde les couleurs saturées */}
        <EffectComposer multisampling={4}>
          <N8AO
            aoRadius={0.35}
            distanceFalloff={0.6}
            intensity={2.2}
            quality="high"
          />
          <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        </EffectComposer>
      </Canvas>
      <DeviceLoader progress={ready ? 100 : progress} done={ready} />
    </div>
  )
}

// Éclairage réaliste :
// - une vraie photo de studio à 360° (HDRI Poly Haven, CC0) pour les reflets et la lumière d'ambiance
// - une lumière principale, alignée sur la grande boîte à lumière du studio, qui projette
//   de vraies ombres (charnière sur le capot, molette dans sa fente, creux des écrans)
function Studio() {
  return (
    <>
      <Environment
        files="/hdri/studio_small_08_512.hdr"
        environmentIntensity={0.9}
      />
      <directionalLight
        position={[-5, 7, 9]}
        intensity={1.4}
        color="#fff7ee"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={6}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-near={1}
        shadow-camera-far={30}
      />
    </>
  )
}

function Device({
  p,
  open,
  onOpenChange,
  onScreensOn,
  onReady,
  focus,
}: {
  p: PluginState
  open: boolean
  onOpenChange: (open: boolean) => void
  onScreensOn: (on: boolean) => void
  onReady: () => void
  focus: boolean
}) {
  const { scene } = useGLTF(MODEL, DRACO)
  // le modèle est chargé (sinon ce composant serait encore en attente) : on le signale
  useEffect(() => onReady(), [onReady])
  const root = useRef<THREE.Group>(null)
  const progress = useRef(0) // 0 = fermé, 1 = ouvert
  const anim = useRef<{ from: number; to: number; t0: number } | null>(null)
  const wheelAngle = useRef(0)
  const drag = useRef<{ y: number; acc: number } | null>(null)
  const [phase, setPhase] = useState<Phase>("closed")
  const power = useRef(0) // luminosité des écrans
  const [hover, setHover] = useState(false)
  const [screenCursor, setScreenCursor] = useState<string | null>(null)
  const { size } = useThree()

  const wheelNode = scene.getObjectByName("Wheel")

  // Matériaux, façon Braun / Teenage Engineering :
  // coque, charnière et moyeu de la molette en plastique anthracite,
  // similicuir noir au dos (cœur embossé dans la texture), molette orange,
  // gravure et code-barres imprimés en blanc, petites pièces sombres (fentes, connecteur).
  // Tout projette et reçoit des ombres, sauf les écrans (ils émettent leur propre lumière).
  useEffect(() => {
    const shell = blackPlastic()
    const leather = leatherPanel()
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      const name = (o.material as THREE.Material).name
      const screen = o.name.startsWith("Screen_")
      o.castShadow = !screen
      o.receiveShadow = !screen
      if (o.name === "Wheel_Knurl") {
        o.material = new THREE.MeshStandardMaterial({
          color: ORANGE_ALBEDO,
          envMapIntensity: 0.35,
          metalness: 0,
          roughness: 0.45,
        })
        // la molette dépasse un peu plus de la tranche, pour qu'on la voie bien
        if (o.parent) o.parent.position.x = 2.31
      } else if (o.name.startsWith("Lid_")) o.material = leather
      else if (name === "Brushed_Metal" || o.name.startsWith("Hinge_"))
        o.material = shell
      // « HUGTYPE-01 » et le code-barres : imprimés en blanc sur le plastique
      else if (name === "Engraving")
        o.material = new THREE.MeshStandardMaterial({
          name,
          color: "#ececec",
          metalness: 0,
          roughness: 0.6,
        })
      else if (name === "Anodized_Black")
        o.material = new THREE.MeshStandardMaterial({
          name,
          color: "#1a1a1b",
          metalness: 0,
          roughness: 0.6,
        })
    })
  }, [scene])

  // Ouvrir / fermer : on lance l'animation de la charnière
  useEffect(() => {
    const to = open ? 1 : 0
    if (progress.current === to) return
    anim.current = { from: progress.current, to, t0: performance.now() }
    setPhase(open ? "opening" : "closing")
    if (!open) onScreensOn(false)
  }, [open, onScreensOn])

  // Le curseur : celui de l'écran survolé, ou la « main » quand on peut cliquer sur l'objet
  useEffect(() => {
    document.body.style.cursor = screenCursor ?? (hover ? "pointer" : "")
    return () => {
      document.body.style.cursor = ""
    }
  }, [hover, screenCursor])

  useFrame((state, dt) => {
    const a = anim.current
    if (a) {
      const t = Math.min(1, (performance.now() - a.t0) / OPEN_MS)
      progress.current = a.from + (a.to - a.from) * easeInOutCubic(t)
      if (t === 1) {
        anim.current = null
        setPhase(a.to === 1 ? "open" : "closed")
        if (a.to === 1) onScreensOn(true)
      }
    }
    const k = progress.current
    const time = state.clock.elapsedTime

    // Les écrans s'allument à la fin de l'ouverture (et s'éteignent dès qu'on referme)
    power.current = THREE.MathUtils.smoothstep(k, 0.7, 1)

    // Charnière : 180° fermé, 0° ouvert
    const pivot = state.scene.getObjectByName("Hinge_Pivot")
    if (pivot) pivot.rotation.x = Math.PI * (1 - k)

    // Fermé, l'objet flotte de trois quarts ; ouvert, il se met bien de face
    if (root.current) {
      const idle = 1 - k
      root.current.rotation.y = -0.5 * idle + Math.sin(time * 0.6) * 0.06 * idle
      root.current.rotation.x = 0.18 * idle + Math.sin(time * 0.8) * 0.03 * idle
      root.current.position.y = Math.sin(time * 1.1) * 0.08 * idle
    }

    // Caméra : cadre l'objet fermé, puis recule pour cadrer l'objet ouvert
    const cam = state.camera as THREE.PerspectiveCamera
    const tan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
    const aspect = size.width / size.height
    // de l'air autour de l'objet sur grand écran ; sur téléphone, il prend toute la place
    const margin = focus ? 1.06 : aspect < 0.8 ? 1.02 : 1.32
    const h = THREE.MathUtils.lerp(CLOSED_H, OPEN_H, k) * margin
    const w = OPEN_W * margin
    const dist = Math.max(h / 2 / tan, w / 2 / (tan * aspect))
    const targetY = THREE.MathUtils.lerp(BOTTOM_CENTER, 0, k)
    // on vise un peu sous le centre : l'objet remonte vers le texte au-dessus
    const lift = h * 0.08
    // en plein écran, on décale un peu vers la droite pour garder la molette dans le cadre
    const shiftX = focus ? 0.2 * k : 0
    cam.position.set(shiftX, targetY - lift, dist)
    cam.lookAt(shiftX, targetY - lift, 0)

    // Molette : elle tourne d'une dent par pixel de réglage
    const wheel = state.scene.getObjectByName("Wheel")
    if (wheel) {
      const value = p.activeSlider === "start" ? p.settings.start : p.margin
      wheelAngle.current = THREE.MathUtils.damp(
        wheelAngle.current,
        value * TOOTH,
        14,
        dt
      )
      wheel.rotation.z = wheelAngle.current
    }
  })

  function isWheel(o: THREE.Object3D | null) {
    for (let n = o; n; n = n.parent) if (n.name === "Wheel") return true
    return false
  }
  function isHinge(o: THREE.Object3D) {
    return o.name.startsWith("Hinge_")
  }

  function onClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    if (phase === "closed") onOpenChange(true)
    else if (phase === "open" && isHinge(e.object)) onOpenChange(false)
  }

  function onPointerMove(e: ThreeEvent<PointerEvent>) {
    const can =
      phase === "closed" ||
      (phase === "open" && (isHinge(e.object) || isWheel(e.object)))
    if (can !== hover) setHover(can)
  }

  // Molette : on la fait rouler en glissant vers le haut / le bas…
  function onWheelDown(e: ThreeEvent<PointerEvent>) {
    if (phase !== "open") return
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    drag.current = { y: e.clientY, acc: 0 }
  }
  function onWheelMove(e: ThreeEvent<PointerEvent>) {
    const d = drag.current
    if (!d) return
    e.stopPropagation()
    d.acc += d.y - e.clientY
    d.y = e.clientY
    const steps = Math.trunc(d.acc / DRAG_PX_PER_STEP)
    if (steps) {
      d.acc -= steps * DRAG_PX_PER_STEP
      if (p.nudge(steps)) tick()
    }
  }
  function onWheelUp(e: ThreeEvent<PointerEvent>) {
    if (!drag.current) return
    ;(e.target as Element).releasePointerCapture(e.pointerId)
    drag.current = null
  }
  // … ou avec la molette de la souris en la survolant
  function onWheelScroll(e: ThreeEvent<WheelEvent>) {
    if (phase !== "open") return
    e.stopPropagation()
    if (p.nudge(e.deltaY < 0 ? 1 : -1)) tick()
  }

  return (
    <group ref={root}>
      <primitive
        object={scene}
        onClick={onClick}
        onPointerMove={onPointerMove}
        onPointerOut={() => setHover(false)}
      />

      <DeviceScreens
        p={p}
        scene={scene}
        power={power}
        interactive={phase === "open"}
        setCursor={setScreenCursor}
      />

      {wheelNode &&
        createPortal(
          <mesh
            rotation-x={Math.PI / 2}
            onPointerDown={onWheelDown}
            onPointerMove={onWheelMove}
            onPointerUp={onWheelUp}
            onPointerCancel={onWheelUp}
            onWheel={onWheelScroll}
            onPointerOver={() => phase === "open" && setHover(true)}
          >
            {/* zone de prise un peu plus large que la molette, plus facile à attraper */}
            <cylinderGeometry args={[0.5, 0.5, 0.4, 24]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>,
          wheelNode
        )}
    </group>
  )
}

// Texture de bruit (niveaux de gris) : grain fin du microbillage, ou grain du similicuir
function noiseTexture(
  size: number,
  min: number,
  max: number,
  repeat: number,
  blur = 0
) {
  const c = document.createElement("canvas")
  c.width = c.height = size
  const ctx = c.getContext("2d")!
  const img = ctx.createImageData(size, size)
  for (let i = 0; i < size * size; i++) {
    const v = min + Math.random() * (max - min)
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  if (blur) {
    // un léger flou transforme le bruit en petits « galets », comme un cuir grainé
    ctx.filter = `blur(${blur}px)`
    ctx.drawImage(c, 0, 0)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  return tex
}

// Plastique anthracite satiné, avec un grain très fin dans la rugosité (plastique injecté)
function blackPlastic() {
  return new THREE.MeshPhysicalMaterial({
    name: "Black_Plastic",
    color: "#2b2b2e",
    metalness: 0,
    roughness: 1,
    roughnessMap: noiseTexture(256, 100, 140, 24),
    // grain de plastique injecté : une micro-texture en relief, à peine visible
    bumpMap: noiseTexture(256, 70, 190, 24, 0.7),
    bumpScale: 0.5,
    clearcoat: 0.25,
    clearcoatRoughness: 0.5,
  })
}

// Similicuir du capot (noir) avec le cœur HugType embossé dans la matière.
// Une seule texture couvre le panneau (UV = position / 5, cf. Blender) :
// - relief (bump) : le grain du cuir + le cœur légèrement bombé, aux bords adoucis
// - rugosité : le cœur est un peu plus lisse que le grain autour, il accroche la lumière
function leatherPanel() {
  const N = 2048
  // cœur du logo (heart-logo.tsx), 0.8 unité de large, centré sur le panneau
  const HEART =
    "M11.459 3.98242L15.4297 0.0126953L22.9062 7.49023L18.9365 11.46L19 11.5234L11.5234 19L11.46 18.9365L11.4082 18.9883L3.93164 11.5107L3.98242 11.459L0 7.47656L7.47656 0L11.459 3.98242Z"
  const s = (0.8 / 22.9062 / 5) * N
  function heart(ctx: CanvasRenderingContext2D, blur: number, fill: string) {
    ctx.save()
    ctx.filter = `blur(${blur}px)`
    // l'UV v est inversé à l'export glTF, et le capot est retourné une fois fermé
    ctx.translate(N / 2, N / 2)
    ctx.scale(s, -s)
    ctx.translate(-11.4531, -9.5)
    ctx.fillStyle = fill
    ctx.fill(new Path2D(HEART))
    ctx.restore()
  }
  function grain(ctx: CanvasRenderingContext2D, amount: number) {
    const img = ctx.getImageData(0, 0, N, N)
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * amount
      img.data[i] += n
      img.data[i + 1] += n
      img.data[i + 2] += n
    }
    ctx.putImageData(img, 0, 0)
  }
  function canvas() {
    const c = document.createElement("canvas")
    c.width = c.height = N
    return [c, c.getContext("2d", { willReadFrequently: true })!] as const
  }

  const [bumpC, b] = canvas()
  b.fillStyle = "rgb(90,90,90)"
  b.fillRect(0, 0, N, N)
  heart(b, 4, "rgb(215,215,215)")
  grain(b, 46)
  // grain arrondi en petits « galets »
  b.filter = "blur(0.8px)"
  b.drawImage(bumpC, 0, 0)

  const [roughC, r] = canvas()
  r.fillStyle = "rgb(230,230,230)"
  r.fillRect(0, 0, N, N)
  heart(r, 5, "rgb(130,130,130)")
  grain(r, 20)

  const tex = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c)
    t.flipY = false
    t.anisotropy = 8
    return t
  }
  return new THREE.MeshStandardMaterial({
    name: "Black_Leather",
    // similicuir noir (le grain et le cœur embossé restent dans la texture)
    color: "#1b1b1d",
    metalness: 0,
    roughness: 1,
    envMapIntensity: 0.35,
    roughnessMap: tex(roughC),
    bumpMap: tex(bumpC),
    bumpScale: 6,
  })
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

useGLTF.preload(MODEL, DRACO)
