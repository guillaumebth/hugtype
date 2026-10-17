# CLAUDE.md — Stack frontend 2025

## À lire en premier

Ce fichier est un **CLAUDE.md** : il doit être placé à la racine de chaque projet pour que Claude le lise automatiquement au démarrage et adapte son comportement.

La personne qui travaille sur ce projet est **designer, pas développeur**. Elle a une excellente sensibilité visuelle et produit des interfaces soignées, mais elle n'est pas à l'aise avec les concepts backend, les erreurs de compilation cryptiques ou les architectures complexes.

En tant qu'assistant sur ces projets, Claude doit :
- Favoriser des explications claires et visuelles plutôt que techniques
- Ne jamais supposer de connaissances en backend, base de données ou DevOps
- Toujours expliquer le *pourquoi* d'un choix, pas seulement le *comment*
- Proposer des solutions simples avant des solutions optimales mais complexes
- Signaler clairement quand quelque chose sort du scope frontend pur

---

## Stack de référence

| Outil | Version | Rôle |
|---|---|---|
| Next.js | 16 (latest) | Framework |
| React | 19 | UI |
| Tailwind CSS | v4 | Styles |
| shadcn/ui | latest (preset Nova) | Composants + icônes Lucide + font Geist |
| TypeScript | 5+ | Typage |
| react-hook-form + Zod | latest | Formulaires |
| lucide-react | latest | Icônes |
| next-themes | latest | Dark mode |
| Sonner | latest | Toasts |

---

## Initialiser un projet

Une seule commande, sans interaction, sans questions :

```bash
npx shadcn@latest init -t next --no-monorepo -b radix -p nova -n nom-du-projet -y
```

Remplacer `nom-du-projet` par le nom voulu (ex: `my-app`).

Ce que fait cette commande :
- Crée le projet Next.js avec TypeScript
- Installe Tailwind v4
- Configure shadcn avec le preset **Nova** (Lucide + Geist)
- Pas de monorepo, pas de questions interactives

Ensuite, installer les dépendances complémentaires :

```bash
npm install next-themes sonner react-hook-form @hookform/resolvers zod
```

Node.js **20.9+** requis.

---

## Configuration post-installation

### 1. Changer l'attribut du dark mode

Dans `components/theme-provider.tsx`, remplacer `attribute="class"` par `attribute="data-theme"` :

```tsx
<NextThemesProvider
  attribute="data-theme"
  defaultTheme="system"
  enableSystem
  ...
>
```

### 2. Mettre à jour globals.css

Remplacer la ligne `@custom-variant dark` et le sélecteur `.dark` :

```css
/* Remplacer */
@custom-variant dark (&:is(.dark *));
.dark { ... }

/* Par */
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
[data-theme=dark] { ... }
```

### 3. Ajouter Sonner dans layout.tsx

```tsx
import { Toaster } from "sonner"

// Dans le JSX :
<ThemeProvider>
  {children}
  <Toaster />
</ThemeProvider>
```

### 4. Créer la structure de dossiers

```bash
mkdir -p hooks stores
```

---

## Composants : Server vs Client

Next.js rend les composants côté serveur par défaut. Pour un projet front, la règle est simple :

- **Pas d'interactivité** (affichage pur, layout, texte) → laisser en Server Component, ne rien ajouter
- **Interactivité** (état, événements, hooks) → ajouter `"use client"` en haut du fichier

```tsx
// ✅ Server Component — pas de directive, affichage simple
export default function Hero() {
  return <h1 className="text-4xl font-bold">Bonjour</h1>
}

// ✅ Client Component — interactivité nécessaire
"use client"
import { useState } from "react"

export function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

> **À noter** : pour un projet principalement front sans base de données, la plupart des composants seront `"use client"`. C'est tout à fait normal.

---

## React 19 — ce qui change

**Plus de `forwardRef`** — `ref` est maintenant une prop normale :
```tsx
function Input({ ref, ...props }: React.ComponentProps<"input">) {
  return <input ref={ref} {...props} />
}
```

**`useOptimistic`** — mettre à jour l'UI avant la confirmation :
```tsx
const [optimisticItems, addOptimistic] = useOptimistic(items)
```

**`use()`** — lire un Context dans n'importe quel composant :
```tsx
const theme = use(ThemeContext)
```

**React Compiler intégré dans Next.js 16** — ne pas écrire `useMemo` / `useCallback` manuellement, c'est géré automatiquement.

---

## Tailwind CSS v4

**Pas de `tailwind.config.ts`** — tout se configure dans `globals.css` :

```css
@import "tailwindcss";
@import "tw-animate-css";

/* Thème personnalisé */
@theme inline {
  --color-brand: oklch(0.7 0.15 200);
  --font-sans: "Inter", sans-serif;
  --radius-md: 0.5rem;
}

/* Couleurs sémantiques shadcn */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
}

[data-theme=dark] {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
}

/* Dark mode sans erreur d'hydratation */
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
```

Les variables `@theme` génèrent automatiquement les classes utilitaires : `bg-brand`, `text-brand`, etc.

**Nouveautés v4 à connaître :**
- `size-*` à la place de `w-* h-*` quand les deux dimensions sont identiques (`size-4` = `w-4 h-4`)
- Couleurs en **OKLCH** (nouveau standard shadcn/ui)
- `tailwindcss-animate` est déprécié → utiliser `tw-animate-css`

---

## shadcn/ui

Les composants sont **copiés dans votre projet** (`/components/ui/`), pas une dépendance npm — ils sont modifiables librement.

```bash
npx shadcn@latest add button card dialog form input sheet
```

Points importants :
- Preset par défaut : **Nova** (Lucide + Geist)
- **Toast** : le composant `toast` de shadcn est déprécié → utiliser **Sonner**
- **Dark mode** : via `next-themes` avec l'attribut `data-theme` (pas les classes CSS)

---

## Structure de projet

```
app/
├── layout.tsx
├── globals.css
└── (pages)/
components/
├── ui/                # Composants shadcn (auto-générés, ne pas modifier)
└── [feature]/         # Tes composants custom
hooks/                 # Custom hooks
lib/
└── utils.ts           # cn() et helpers
```

---

## État global

Utiliser `useState` local par défaut. Si l'état doit être partagé entre plusieurs composants éloignés, utiliser le **Context API** de React :

```tsx
"use client"
import { createContext, useContext, useState } from "react"

const UIContext = createContext<{ sidebarOpen: boolean; toggleSidebar: () => void } | null>(null)

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return (
    <UIContext.Provider value={{ sidebarOpen, toggleSidebar: () => setSidebarOpen(o => !o) }}>
      {children}
    </UIContext.Provider>
  )
}

export const useUI = () => {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error("useUI must be used within UIProvider")
  return ctx
}
```

---

## Formulaires — react-hook-form + Zod + shadcn

```tsx
"use client"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const schema = z.object({
  email: z.string().email("Email invalide"),
})

export function ContactForm() {
  const form = useForm({ resolver: zodResolver(schema) })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(console.log)} className="space-y-4">
        <FormField name="email" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl><Input placeholder="toi@exemple.fr" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit">Envoyer</Button>
      </form>
    </Form>
  )
}
```

---

## Bonnes pratiques

- Images : toujours `next/image` — jamais `<img>`
- Liens : toujours `next/link` — jamais `<a>` pour la navigation interne
- TypeScript strict — pas de `any`
- Ne jamais écrire `useMemo` / `useCallback` (React Compiler le fait)
- Les composants shadcn dans `/ui/` ne se modifient pas — créer un wrapper dans `/components/[feature]/`
- Toute la config de couleurs/thème dans `globals.css`, nulle part ailleurs
- Toujours `suppressHydrationWarning` sur la balise `<html>` quand on utilise next-themes
