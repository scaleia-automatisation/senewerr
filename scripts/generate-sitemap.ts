/**
 * Sitemap generator — run at build time with Deno:
 *   deno run --allow-env --allow-net --allow-write scripts/generate-sitemap.ts
 *
 * Required env vars:
 *   SUPABASE_URL              (optional, defaults to production)
 *   SUPABASE_SERVICE_ROLE_KEY (required)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL =
  Deno.env.get('SUPABASE_URL') ?? 'https://oosgigliuhztuktkqdgn.supabase.co'
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')

const db = createClient(SUPABASE_URL, SERVICE_KEY)

const BASE = 'https://medikool.sn'
const today = new Date().toISOString().split('T')[0]

// ── Static pages ──────────────────────────────────────────────────────────────
const statics = [
  { loc: '/', priority: '1.0', changefreq: 'weekly' },
  { loc: '/tarifs', priority: '0.9', changefreq: 'monthly' },
  { loc: '/blog', priority: '0.8', changefreq: 'daily' },
  { loc: '/contact', priority: '0.6', changefreq: 'yearly' },
  { loc: '/mentions-legales', priority: '0.3', changefreq: 'yearly' },
  { loc: '/confidentialite', priority: '0.3', changefreq: 'yearly' },
  { loc: '/cgu', priority: '0.3', changefreq: 'yearly' },
  { loc: '/cgv', priority: '0.3', changefreq: 'yearly' },
  { loc: '/cookies', priority: '0.3', changefreq: 'yearly' },
  { loc: '/remboursements', priority: '0.4', changefreq: 'yearly' },
  { loc: '/securite', priority: '0.4', changefreq: 'yearly' },
]

// ── Blog articles ─────────────────────────────────────────────────────────────
const { data: articles, error: blogError } = await db
  .from('blog_posts')
  .select('slug, updated_at, published_at')
  .eq('status', 'published')

if (blogError) console.warn('blog_posts query failed:', blogError.message)

// deno-lint-ignore no-explicit-any
const blogUrls = (articles ?? []).map((a: any) => ({
  loc: `/blog/${a.slug}`,
  lastmod: (a.updated_at ?? a.published_at ?? today).split('T')[0],
  priority: '0.7',
  changefreq: 'monthly',
}))

// ── Verified professional profiles ────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
const { data: pros, error: proError } = await (db as any)
  .from('professionals')
  .select('id, slug, updated_at')
  .eq('verification_status', 'verified')
  .not('slug', 'is', null)

if (proError) console.warn('professionals query failed:', proError.message)

// deno-lint-ignore no-explicit-any
const proUrls = (pros ?? []).map((p: any) => ({
  loc: `/pro/${p.slug ?? p.id}`,
  lastmod: (p.updated_at ?? today).split('T')[0],
  priority: '0.6',
  changefreq: 'weekly',
}))

// ── Verified pharmacy profiles ────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
const { data: pharmacies, error: pharmaError } = await (db as any)
  .from('organizations')
  .select('id, slug, updated_at')
  .eq('type', 'pharmacy')
  .eq('verification_status', 'verified')
  .not('slug', 'is', null)

if (pharmaError) console.warn('organizations query failed:', pharmaError.message)

// deno-lint-ignore no-explicit-any
const pharmacyUrls = (pharmacies ?? []).map((p: any) => ({
  loc: `/pharmacie/${p.slug ?? p.id}`,
  lastmod: (p.updated_at ?? today).split('T')[0],
  priority: '0.5',
  changefreq: 'weekly',
}))

// ── Build XML ─────────────────────────────────────────────────────────────────
const allUrls = [...statics, ...blogUrls, ...proUrls, ...pharmacyUrls]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${BASE}${u.loc}</loc>
    <lastmod>${'lastmod' in u ? u.lastmod : today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`

await Deno.writeTextFile('apps/web/public/sitemap.xml', xml)
console.log(`✓ sitemap.xml generated: ${allUrls.length} URLs`)
console.log(
  `  static=${statics.length}, blog=${blogUrls.length}, pro=${proUrls.length}, pharma=${pharmacyUrls.length}`,
)
