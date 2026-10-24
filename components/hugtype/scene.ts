// État partagé entre les feuilles (DOM) et le texte de fond (canvas).
// C'est un simple objet mutable : il change 60 fois par seconde,
// on évite donc de passer par le state React.

export type Box = {
  // centre, taille, rotation (degrés) et échelle, en px écran
  cx: number
  cy: number
  w: number
  h: number
  rot: number
  scale: number
  // rendu « papier » (lu par le canvas WebGL)
  z: number // ordre d'empilement
  opacity: number
  lift: number // 0 posée, 1 soulevée
  bendX: number // courbure due au mouvement, en px, repère de la feuille
  bendY: number
  grabX: number // point attrapé, de -0.5 à 0.5 dans la feuille
  grabY: number
}

export type Scene = {
  sheets: Map<string, Box>
  // zones fixes à contourner (titre, bouton...), en px écran
  blocks: { x: number; y: number; w: number; h: number }[]
  // incrémenté à chaque changement des obstacles
  version: number
}

export function createScene(): Scene {
  return { sheets: new Map(), blocks: [], version: 0 }
}

export function setBlocks(scene: Scene, blocks: Scene["blocks"]) {
  scene.blocks = blocks
  scene.version++
}

// Coins d'une feuille tournée, avec une marge autour
export function boxCorners(b: Box, pad: number) {
  const hw = (b.w * b.scale) / 2 + pad
  const hh = (b.h * b.scale) / 2 + pad
  const a = (b.rot * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([x, y]) => [b.cx + x * c - y * s, b.cy + x * s + y * c] as const)
}
