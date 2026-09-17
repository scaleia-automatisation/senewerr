/**
 * check-routes.ts — vérifie que toutes les routes attendues sont définies dans le router
 *
 * Usage (Deno) :
 *   deno run --allow-read scripts/check-routes.ts
 */

// ── Routes publiques attendues ────────────────────────────────────────────────
const EXPECTED_PUBLIC_ROUTES = [
  '/',
  '/tarifs',
  '/blog',
  '/blog/:slug',
  '/contact',
  '/mentions-legales',
  '/confidentialite',
  '/cgu',
  '/cgv',
  '/cookies',
  '/remboursements',
  '/securite',
  '/pro/:slug',
  '/pharmacie/:slug',
  '/recherche-publique',
]

// ── Routes auth attendues ─────────────────────────────────────────────────────
const EXPECTED_AUTH_ROUTES = [
  '/auth/connexion',
  '/auth/inscription',
  '/auth/2fa',
  '/invitation/:token',
  '/auth/mot-de-passe-oublie',
  '/auth/nouveau-mot-de-passe',
]

// ── Routes admin attendues ────────────────────────────────────────────────────
const EXPECTED_ADMIN_ROUTES = [
  '/admin',
  '/admin/acteurs',
  '/admin/commandes',
  '/admin/rendez-vous',
  '/admin/paiements',
  '/admin/litiges',
  '/admin/ordonnances-signalees',
  '/admin/contenu',
  '/admin/ia',
  '/admin/audit',
  '/admin/securite',
  '/admin/recherche',
]

// ── Routes super-admin attendues ──────────────────────────────────────────────
const EXPECTED_SUPER_ADMIN_ROUTES = [
  '/super-admin',
  '/super-admin/parametres',
  '/super-admin/plans',
  '/super-admin/promo',
  '/super-admin/paiements-config',
  '/super-admin/notifications-config',
  '/super-admin/roles',
  '/super-admin/admins',
  '/super-admin/credits',
  '/super-admin/integrations',
  '/super-admin/analytics',
]

const ALL_EXPECTED = [
  ...EXPECTED_PUBLIC_ROUTES,
  ...EXPECTED_AUTH_ROUTES,
  ...EXPECTED_ADMIN_ROUTES,
  ...EXPECTED_SUPER_ADMIN_ROUTES,
]

// ── Lecture des fichiers de routing ──────────────────────────────────────────
function readRouterFiles(dir: string): string {
  const content: string[] = []

  function readDir(d: string) {
    let entries: Iterable<Deno.DirEntry>
    try {
      entries = Deno.readDirSync(d)
    } catch {
      return
    }
    for (const entry of entries) {
      const p = `${d}/${entry.name}`
      if (entry.isDirectory) {
        readDir(p)
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
        try {
          content.push(Deno.readTextFileSync(p))
        } catch { /* skip */ }
      }
    }
  }

  readDir(dir)
  return content.join('\n')
}

const routerContent = [
  readRouterFiles('apps/web/src/app'),
].join('\n')

// ── Vérification ─────────────────────────────────────────────────────────────
const missing: string[] = []
const found: string[] = []

for (const route of ALL_EXPECTED) {
  // Segments terminaux extraits des patterns de route
  const bare = route
    .replace(/\/:[\w]+/g, '')          // retire les paramètres dynamiques
    .split('/')
    .filter(Boolean)
    .pop() ?? route

  const present =
    routerContent.includes(`"${route}"`) ||
    routerContent.includes(`'${route}'`) ||
    routerContent.includes(`path="${bare}"`) ||
    routerContent.includes(`path='${bare}'`) ||
    routerContent.includes(`path="${route}"`) ||
    routerContent.includes(`path='${route}'`)

  if (present) {
    found.push(route)
  } else {
    missing.push(route)
  }
}

// ── Rapport ───────────────────────────────────────────────────────────────────
console.log('\n=== check-routes.ts ===\n')
console.log(`Routes trouvées  : ${found.length}/${ALL_EXPECTED.length}`)

if (missing.length > 0) {
  console.log(`\nRoutes manquantes (${missing.length}) :`)
  missing.forEach((r) => console.log(`   - ${r}`))
  Deno.exit(1)
} else {
  console.log('\nToutes les routes sont présentes.')
  Deno.exit(0)
}
