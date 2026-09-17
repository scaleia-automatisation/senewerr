// Vérifie les ratios de contraste WCAG AA sur les paires texte/fond des tokens.
// Usage : node scripts/contrast-check.mjs   (script npm : a11y:contrast)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(__dirname, '../src/styles/tokens.css'), 'utf8')

// Extrait les tokens hex du bloc :root (mode clair)
const root = css.slice(css.indexOf(':root'), css.indexOf('.dark'))
const tokens = {}
for (const m of root.matchAll(/(--[\w-]+):\s*(#[0-9A-Fa-f]{6})/g)) {
  tokens[m[1]] = m[2]
}

function toRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function luminance(hex) {
  const [r, g, b] = toRgb(hex).map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function ratio(a, b) {
  const l1 = luminance(a)
  const l2 = luminance(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

// Paires [texte, fond, seuil AA]  (3:1 pour gros texte / composants, 4.5:1 pour le corps)
const PAIRS = [
  ['--ink', '--bg', 4.5],
  ['--ink-2', '--bg', 4.5],
  ['--ink-3', '--bg', 4.5],
  ['--ink', '--surface', 4.5],
  ['--primary', '--bg', 3],
  ['--primary-fg', '--primary', 4.5],
  ['--accent-fg', '--accent', 4.5],
  ['--status-success', '--bg', 3],
  ['--status-pending', '--bg', 3],
  ['--status-progress', '--bg', 3],
  ['--status-danger', '--bg', 3],
]

let failed = 0
for (const [fg, bg, min] of PAIRS) {
  if (!tokens[fg] || !tokens[bg]) {
    console.error(`✗ Token manquant : ${fg} ou ${bg}`)
    failed++
    continue
  }
  const r = ratio(tokens[fg], tokens[bg])
  const ok = r >= min
  if (!ok) failed++
  console.log(`${ok ? '✔' : '✗'} ${fg} sur ${bg} = ${r.toFixed(2)}:1 (min ${min})`)
}

if (failed > 0) {
  console.error(`\n${failed} paire(s) sous le seuil AA.`)
  process.exit(1)
}
console.log('\nToutes les paires respectent le contraste AA.')
