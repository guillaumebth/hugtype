// Lien vers la page Figma Community du plugin (à remplacer par l'URL définitive)
export const FIGMA_URL = "https://www.figma.com/community"

export const SITE_NAME = "HugType"
export const SITE_TITLE = "HugType · Make your text hug anything"
export const SITE_DESCRIPTION =
  "A free Figma plugin to wrap text around, inside or along any cutout image."
export const AUTHOR = { name: "Guillaume Berthonneau", url: "https://guillaume.info" }

// Adresse publique du site : à définir dans NEXT_PUBLIC_SITE_URL une fois le domaine choisi.
// Sur Vercel, l'URL de production est prise automatiquement.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")

export type Sheet = {
  id: string
  title: string
  src: string
  width: number
  height: number
  // Position de départ sur le bureau, en px dans une maquette de 1440 × 937
  // (centre de la feuille), largeur affichée et rotation en degrés
  desk: { x: number; y: number; w: number; rot: number }
}

// Ordre = empilement de départ (le dernier est au-dessus)
export const SHEETS: Sheet[] = [
  {
    id: "user-guide",
    title: "User guide",
    src: "/sheets/user-guide.jpg",
    width: 1393,
    height: 920,
    desk: { x: 250, y: 430, w: 520, rot: 18.5 },
  },
  {
    id: "salomon",
    title: "Salomon Cross Low Drawstring",
    src: "/sheets/salomon.jpg",
    width: 1050,
    height: 1491,
    desk: { x: 748, y: 718, w: 262, rot: 0 },
  },
  {
    id: "interface",
    title: "Interface",
    src: "/sheets/interface.jpg",
    width: 1393,
    height: 920,
    desk: { x: 1140, y: 720, w: 520, rot: -18 },
  },
  {
    id: "sitting-still",
    title: "The art of sitting still",
    src: "/sheets/sitting-still.jpg",
    width: 1050,
    height: 1491,
    desk: { x: 1300, y: 513, w: 262, rot: 0 },
  },
  {
    id: "ootd",
    title: "OOTD",
    src: "/sheets/ootd.jpg",
    width: 1050,
    height: 1491,
    desk: { x: 915, y: 478, w: 262, rot: -12 },
  },
  {
    id: "zero-gravity",
    title: "Zero gravity",
    src: "/sheets/zero-gravity.jpg",
    width: 1045,
    height: 1480,
    desk: { x: 400, y: 655, w: 262, rot: 14.5 },
  },
]
