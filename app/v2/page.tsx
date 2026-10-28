import { redirect } from "next/navigation"

// La v2 (l'objet 3D) est maintenant la page d'accueil
export default function Page() {
  redirect("/")
}
