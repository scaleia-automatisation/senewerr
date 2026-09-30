/**
 * generate-images.mjs
 * Génère les images DALL-E 3 pour Séné Wérr → public/images/
 * Usage : node scripts/generate-images.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import https from 'https'
import http from 'http'

const __dir = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dir, '..')

/* ── Lire .env.local ─────────────────────────────────────────────────────── */
function readEnv() {
  const env = {}
  for (const line of readFileSync(join(rootDir, '.env.local'), 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_0-9]+)\s*=\s*(.+)$/)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

/* ── Télécharger une URL vers un fichier ─────────────────────────────────── */
function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http
    proto.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return download(res.headers.location, destPath).then(resolve).catch(reject)
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => { writeFileSync(destPath, Buffer.concat(chunks)); resolve(destPath) })
      res.on('error', reject)
    }).on('error', reject)
  })
}

/* ── Appel OpenAI images.generate via fetch (openai v7) ─────────────────── */
async function generateDalle3(apiKey, prompt, size) {
  const body = JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size, quality: 'high', output_format: 'png' })
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API ${res.status}: ${err}`)
  }
  const data = await res.json()
  // gpt-image-1 retourne b64_json ; dall-e-3 retourne url
  if (data.data[0].b64_json) return { type: 'b64', data: data.data[0].b64_json }
  return { type: 'url', data: data.data[0].url }
}

/* ── Images à générer ────────────────────────────────────────────────────── */
const IMAGES = [
  {
    id: 'hero-landing',
    filename: 'hero-landing.png',
    size: '1536x1024',
    prompt: 'Documentary photograph, young Senegalese woman in her 30s sitting at home in Dakar, using a smartphone, calm and satisfied expression, soft warm window light, modern modest apartment with warm colors, shallow depth of field, natural real photography, healthcare mobile app context, no text, horizontal format.',
  },
  {
    id: 'actor-patient',
    filename: 'actor-patient.png',
    size: '1536x1024',
    prompt: 'Documentary photograph, Senegalese man in his 40s sitting in a bright modern healthcare waiting room in Dakar, looking at a healthcare app on smartphone, relaxed expression, natural daylight, clean light-colored interior, professional reassuring atmosphere, real photography, no text, horizontal format.',
  },
  {
    id: 'actor-pharmacie',
    filename: 'actor-pharmacie.png',
    size: '1536x1024',
    prompt: 'Documentary photograph, Senegalese female pharmacist in her 30s wearing white lab coat behind a modern pharmacy counter in Dakar, looking at a tablet showing medication management software, bright clean modern pharmacy, organized shelves in background, warm professional lighting, real photography, no text, horizontal format.',
  },
  {
    id: 'actor-professionnel',
    filename: 'actor-professionnel.png',
    size: '1536x1024',
    prompt: 'Documentary photograph, Senegalese doctor or nurse in white coat or scrubs, looking at a digital tablet in a clean modern clinic in Dakar, patient records visible on screen, organized professional medical environment, natural light, confident caring expression, real photography, no text, horizontal format.',
  },
  {
    id: 'actor-mutuelle',
    filename: 'actor-mutuelle.png',
    size: '1536x1024',
    prompt: 'Documentary photograph, Senegalese professional in business attire at a modern desk in a bright office in Dakar, reviewing a laptop showing health insurance dashboard with charts, organized workspace, natural light, modern office furniture, serious approachable expression, real photography, no text, horizontal format.',
  },
]

/* ── Main ────────────────────────────────────────────────────────────────── */
async function main() {
  const { OPENAI_API_KEY: apiKey } = readEnv()
  if (!apiKey) { console.error('❌ OPENAI_API_KEY manquante'); process.exit(1) }

  const outDir = join(rootDir, 'public', 'images')
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  console.log(`\n🎨 Génération de ${IMAGES.length} images DALL-E 3 pour Séné Wérr\n`)

  for (const img of IMAGES) {
    const dest = join(outDir, img.filename)
    if (existsSync(dest)) { console.log(`⏭  ${img.id} — déjà présent`); continue }

    process.stdout.write(`🖼  ${img.id} ... `)
    try {
      const result = await generateDalle3(apiKey, img.prompt, img.size)
      if (result.type === 'b64') {
        writeFileSync(dest, Buffer.from(result.data, 'base64'))
      } else {
        await download(result.data, dest)
      }
      console.log(`✅  public/images/${img.filename}`)
    } catch (e) {
      console.log(`❌  ${e.message}`)
    }
    await new Promise(r => setTimeout(r, 1000))
  }

  console.log('\n✨ Terminé !')
}

main().catch(console.error)
