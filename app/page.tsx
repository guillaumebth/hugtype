import { HomeV2 } from "@/components/device/home-v2"
import { AUTHOR, FIGMA_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site"

// Données structurées : aident Google à comprendre que c'est un plugin gratuit
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  applicationCategory: "DesignApplication",
  operatingSystem: "Figma",
  downloadUrl: FIGMA_URL,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: { "@type": "Person", name: AUTHOR.name, url: AUTHOR.url },
}

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <HomeV2 />
    </>
  )
}
