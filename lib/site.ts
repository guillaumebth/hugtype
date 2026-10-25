// Lien vers la page Figma Community du plugin (à remplacer par l'URL définitive)
export const FIGMA_URL = "https://www.figma.com/community"

export const SITE_NAME = "HugType"
export const SITE_TITLE = "HugType · Make your text hug anything"
export const SITE_DESCRIPTION =
  "A free Figma plugin to wrap text around, inside or along any cutout image."
export const AUTHOR = { name: "Guillaume Berthonneau", url: "https://www.bguillaume.info" }

// Adresse publique du site : à définir dans NEXT_PUBLIC_SITE_URL une fois le domaine choisi.
// Sur Vercel, l'URL de production est prise automatiquement.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
