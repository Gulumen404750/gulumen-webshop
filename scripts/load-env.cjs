/**
 * .env / .env.local betöltése process.env-be (ha még nincs beállítva).
 * Railway-en a platform adja az env-et; lokálisan npm run start-hoz kell.
 */
const fs = require('fs')
const path = require('path')

function loadEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      if (!key || process.env[key] !== undefined) continue
      let val = trimmed.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      process.env[key] = val
    }
  } catch {
    // fájl nem létezik
  }
}

const root = path.join(__dirname, '..')
loadEnvFile(path.join(root, '.env'))
loadEnvFile(path.join(root, '.env.local'))
