# Base — template Next.js + shadcn

Point de départ propre pour chaque nouveau projet : Next.js 16, React 19, Tailwind v4, shadcn/ui (preset Nova), dark mode, Sonner, react-hook-form + Zod. Voir `CLAUDE.md` pour le détail de la stack.

## Démarrer un nouveau projet

1. Dupliquer le dossier `_BAse` et le renommer (ex : `mon-projet`).
2. Dans le nouveau dossier, repartir d'un historique git vierge (sinon le projet garde celui du template) :

```bash
rm -rf .git && git init && npm install && git add -A && git commit -m "Initial commit"
```

3. Changer le nom du projet :
   - `package.json` → `"name": "mon-projet"`
   - `app/layout.tsx` → `title` et `description` dans `metadata`
4. Lancer le site :

```bash
npm run dev
```

Puis ouvrir http://localhost:3000. La touche `d` bascule le dark mode.

## Ajouter des composants

```bash
npx shadcn@latest add card dialog input
```

Ils arrivent dans `components/ui/`.
