"use client"

import { OrbitControls, useGLTF } from "@react-three/drei"
import { Canvas, useFrame } from "@react-three/fiber"
import { useEffect, useRef } from "react"
import * as THREE from "three"

// Le modèle détaillé (celui préparé pour Cinema 4D), à taille réelle, compressé en Draco
const MODEL = "/models/hugtype-device-hd.glb"
const DRACO = "/draco/"
const OPEN_MS = 1500
// repères de l'objet à taille réelle (m) : module de 8,3 cm, épaisseur 9 mm, charnière à l'origine
const CLOSED_CENTER_Y = 0.0435
const HALF_THICK = 0.0045

export type WireMode = "lines" | "mesh"

// Dessin technique : l'objet en traits fins sur fond noir.
// « lines » : silhouettes + arêtes marquées, faces cachées masquées (comme un dessin industriel)
// « mesh » : tout le maillage (triangles), en transparence
export function WireframeScene({
  mode,
  open,
}: {
  mode: WireMode
  open: boolean
}) {
  return (
    <Canvas
      dpr={[1, 2]}
      // cadrage fixe : l'objet ouvert (≈ 17 cm de haut) avec beaucoup d'air autour
      camera={{ fov: 30, position: [0.22, 0.08, 0.58], near: 0.005, far: 10 }}
    >
      <Device mode={mode} open={open} />
      <OrbitControls
        makeDefault
        autoRotate
        autoRotateSpeed={0.6}
        enablePan={false}
        minDistance={0.12}
        maxDistance={0.8}
      />
    </Canvas>
  )
}

const INK = new THREE.Color("#f2f2f2")
const ACCENT = new THREE.Color("#ff3410")

// une pièce est intérieure si elle-même ou un parent s'appelle « Int_… »
function isInternal(o: THREE.Object3D) {
  for (let n: THREE.Object3D | null = o; n; n = n.parent)
    if (n.name.startsWith("Int_")) return true
  return false
}

// Construit une seule fois, pour chaque pièce : un « masque » noir (cache ce qui est derrière),
// les arêtes marquées (au-delà de 6° : arrondis, bords d'écran, vis…) et le maillage brut.
// Puis affiche le mode choisi (en mode maillage, le masque disparaît : on voit à travers).
const built = new WeakSet<THREE.Object3D>()
function applyWire(scene: THREE.Object3D, mode: WireMode) {
  if (!built.has(scene)) {
    const meshes: THREE.Mesh[] = []
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) meshes.push(o)
    })
    for (const m of meshes) {
      // composants intérieurs (« Int_ ») : en orange, visibles à travers la coque, comme une radiographie
      const inner = isInternal(m)
      m.userData.inner = inner
      m.material = new THREE.MeshBasicMaterial({
        color: "#000",
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      })
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(m.geometry, inner ? 20 : 6),
        new THREE.LineBasicMaterial({
          color: inner ? ACCENT : INK,
          transparent: true,
          opacity: inner ? 0.7 : 0.85,
          depthTest: !inner,
        })
      )
      if (inner) edges.renderOrder = 10
      edges.userData = { wire: "lines" }
      const raw = new THREE.LineSegments(
        new THREE.WireframeGeometry(m.geometry),
        new THREE.LineBasicMaterial({
          color: inner ? ACCENT : INK,
          transparent: true,
          opacity: inner ? 0.35 : 0.22,
        })
      )
      raw.userData = { wire: "mesh" }
      m.add(edges, raw)
    }
    built.add(scene)
  }
  scene.traverse((o) => {
    if (o.userData.wire) o.visible = o.userData.wire === mode
    else if (o instanceof THREE.Mesh)
      // le masque noir ne sert qu'à la coque ; les composants ne cachent rien
      (o.material as THREE.Material).visible =
        mode === "lines" && !o.userData.inner
  })
}

function Device({ mode, open }: { mode: WireMode; open: boolean }) {
  const { scene } = useGLTF(MODEL, DRACO)
  const progress = useRef(0)
  const anim = useRef<{ from: number; to: number; t0: number } | null>(null)

  useEffect(() => applyWire(scene, mode), [scene, mode])

  useEffect(() => {
    anim.current = {
      from: progress.current,
      to: open ? 1 : 0,
      t0: performance.now(),
    }
  }, [open])

  useFrame((state) => {
    const a = anim.current
    if (a) {
      const t = Math.min(1, (performance.now() - a.t0) / OPEN_MS)
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      progress.current = a.from + (a.to - a.from) * e
      if (t === 1) anim.current = null
    }
    const pivot = scene.getObjectByName("Hinge_Pivot")
    if (pivot) pivot.rotation.x = Math.PI * (1 - progress.current)

    // l'objet tourne toujours autour de son propre centre : celui de l'objet ouvert (charnière, mi-épaisseur)
    // glisse vers celui de l'objet fermé (le module du bas) pendant la fermeture
    const controls = state.controls as unknown as {
      target: THREE.Vector3
    } | null
    if (controls) {
      const k = progress.current
      controls.target.set(
        0,
        THREE.MathUtils.lerp(-CLOSED_CENTER_Y, 0, k),
        THREE.MathUtils.lerp(0, -HALF_THICK, k)
      )
    }
  })

  return <primitive object={scene} />
}

useGLTF.preload(MODEL, DRACO)
