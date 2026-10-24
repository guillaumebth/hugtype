"use client"

import { gsap } from "gsap"
import { useEffect, useRef } from "react"
import * as THREE from "three"

import type { Scene } from "@/components/hugtype/scene"
import type { Sheet } from "@/lib/site"

// Feuille : un plan subdivisé que le shader plie comme du papier
const SHEET_VERTEX = /* glsl */ `
  uniform vec2 uSize;
  uniform float uLift;
  uniform vec2 uBend;
  uniform vec2 uGrab;
  uniform float uTime;
  varying vec2 vUv;
  varying float vShade;

  float zAt(vec2 p) {
    float diag = length(uSize) * 0.5;
    // bosse autour du point attrapé : le reste de la feuille retombe
    float d = length(p - uGrab) / diag;
    float z = uLift * (30.0 - 22.0 * d * d);
    // le mouvement plie la feuille : le côté arrière se soulève
    float bl = length(uBend);
    if (bl > 0.001) {
      float s = dot(p, uBend / bl) / diag;
      z += bl * s * abs(s);
    }
    // léger frémissement quand elle est en l'air
    z += uLift * 2.0 * sin(p.x * 0.017 + uTime * 2.1) * sin(p.y * 0.013 + uTime * 1.6);
    return z;
  }

  void main() {
    vUv = uv;
    vec2 p = position.xy * uSize;
    float z = zAt(p);
    float e = 2.0;
    vec3 n = normalize(vec3(
      zAt(p - vec2(e, 0.0)) - zAt(p + vec2(e, 0.0)),
      zAt(p - vec2(0.0, e)) - zAt(p + vec2(0.0, e)),
      2.0 * e
    ));
    vec3 light = normalize(vec3(-0.35, 0.55, 1.0));
    vShade = clamp(1.0 + (dot(n, light) - light.z) * 1.6, 0.8, 1.08);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, z, 1.0);
  }
`

const SHEET_FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vShade;

  void main() {
    vec4 c = texture2D(uMap, vUv);
    gl_FragColor = vec4(c.rgb * vShade, uOpacity);
    #include <colorspace_fragment>
  }
`

// Ombre douce : un rectangle flou, sans texture
const SHADOW_VERTEX = /* glsl */ `
  uniform vec2 uPlane;
  varying vec2 vPos;
  void main() {
    vPos = position.xy * uPlane;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(vPos, 0.0, 1.0);
  }
`

const SHADOW_FRAGMENT = /* glsl */ `
  uniform vec2 uSize;
  uniform float uBlur;
  uniform float uOpacity;
  varying vec2 vPos;
  void main() {
    vec2 d = abs(vPos) - uSize * 0.5;
    float sdf = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    float a = 1.0 - smoothstep(-uBlur * 0.6, uBlur, sdf);
    gl_FragColor = vec4(0.0, 0.0, 0.0, a * uOpacity);
  }
`

type Entry = {
  sheet: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  ready: boolean
}

export function PaperCanvas({ scene, sheets }: { scene: Scene; sheets: Sheet[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    const world = new THREE.Scene()
    const FOV = 30
    const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 10000)
    let W = 0
    let H = 0

    function resize() {
      W = window.innerWidth
      H = window.innerHeight
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(W, H, false)
      camera.aspect = W / H
      // à z = 0, 1 unité = 1 px écran
      camera.position.set(0, 0, H / 2 / Math.tan((FOV * Math.PI) / 360))
      camera.updateProjectionMatrix()
    }
    resize()

    const sheetGeo = new THREE.PlaneGeometry(1, 1, 32, 32)
    const shadowGeo = new THREE.PlaneGeometry(1, 1)
    const loader = new THREE.TextureLoader()
    const maxAniso = renderer.capabilities.getMaxAnisotropy()
    const entries = new Map<string, Entry>()

    for (const s of sheets) {
      const sheetMat = new THREE.ShaderMaterial({
        vertexShader: SHEET_VERTEX,
        fragmentShader: SHEET_FRAGMENT,
        uniforms: {
          uMap: { value: null },
          uSize: { value: new THREE.Vector2(1, 1) },
          uLift: { value: 0 },
          uBend: { value: new THREE.Vector2() },
          uGrab: { value: new THREE.Vector2() },
          uTime: { value: 0 },
          uOpacity: { value: 1 },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      })
      const shadowMat = new THREE.ShaderMaterial({
        vertexShader: SHADOW_VERTEX,
        fragmentShader: SHADOW_FRAGMENT,
        uniforms: {
          uPlane: { value: new THREE.Vector2(1, 1) },
          uSize: { value: new THREE.Vector2(1, 1) },
          uBlur: { value: 10 },
          uOpacity: { value: 0.3 },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      })
      const entry: Entry = {
        sheet: new THREE.Mesh(sheetGeo, sheetMat),
        shadow: new THREE.Mesh(shadowGeo, shadowMat),
        ready: false,
      }
      entry.sheet.visible = false
      entry.shadow.visible = false
      world.add(entry.shadow, entry.sheet)
      entries.set(s.id, entry)

      loader.load(s.src, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = maxAniso
        sheetMat.uniforms.uMap.value = tex
        entry.ready = true
      })
    }

    function render(time: number) {
      for (const [id, e] of entries) {
        const b = scene.sheets.get(id)
        if (!b || !e.ready || b.opacity <= 0.01) {
          e.sheet.visible = false
          e.shadow.visible = false
          continue
        }
        const w = b.w * b.scale
        const h = b.h * b.scale
        const rad = (-b.rot * Math.PI) / 180
        const x = b.cx - W / 2
        const y = H / 2 - b.cy

        const su = e.sheet.material.uniforms
        e.sheet.visible = true
        e.sheet.position.set(x, y, 0)
        e.sheet.rotation.z = rad
        e.sheet.renderOrder = b.z * 2 + 1
        su.uSize.value.set(w, h)
        su.uLift.value = b.lift
        // repère écran (y vers le bas) -> repère WebGL (y vers le haut)
        su.uBend.value.set(b.bendX, -b.bendY)
        su.uGrab.value.set(b.grabX * w, -b.grabY * h)
        su.uTime.value = time
        su.uOpacity.value = b.opacity

        // ombre légère, qui s'éloigne et s'adoucit quand la feuille monte
        const blur = 8 + b.lift * 18
        const du = e.shadow.material.uniforms
        e.shadow.visible = true
        e.shadow.position.set(x + b.lift * 3, y - 2 - b.lift * 7, 0)
        e.shadow.rotation.z = rad
        e.shadow.renderOrder = b.z * 2
        du.uSize.value.set(w * (1 - b.lift * 0.03), h * (1 - b.lift * 0.03))
        du.uPlane.value.set(w + blur * 3, h + blur * 3)
        du.uBlur.value = blur
        du.uOpacity.value = (0.14 + b.lift * 0.06) * b.opacity
      }
      renderer.render(world, camera)
    }

    gsap.ticker.add(render)
    window.addEventListener("resize", resize)
    return () => {
      gsap.ticker.remove(render)
      window.removeEventListener("resize", resize)
      for (const e of entries.values()) {
        e.sheet.material.uniforms.uMap.value?.dispose()
        e.sheet.material.dispose()
        e.shadow.material.dispose()
      }
      sheetGeo.dispose()
      shadowGeo.dispose()
      renderer.dispose()
    }
  }, [scene, sheets])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[5] block size-full"
    />
  )
}
