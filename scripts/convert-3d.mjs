#!/usr/bin/env node
/**
 * 3D modell pipeline: STL / OBJ / GLTF → GLB → optimalizált GLB (webshop használatra).
 * 1) Konvertálás: @polar3d/model-converter (STL/OBJ/3MF/GLTF → GLB)
 * 2) Optimalizálás: gltf-transform optimize (tömörítés, mesh, gyorsabb web)
 *
 * Használat:
 *   npm run convert-3d -- model.stl
 *   npm run convert-3d -- model.stl --out public/models
 *   npm run convert-3d -- model.obj
 *   npm run convert-3d:batch   (összes .stl/.obj a scripts/3d-input mappából → public/models)
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, unlinkSync, statSync } from 'fs'
import { join, dirname, basename, extname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

// Node.js polyfill for Three.js GLTFExporter (uses FileReader)
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    constructor() {
      this.result = null
      this.onloadend = null
    }
    readAsArrayBuffer(blob) {
      Promise.resolve(blob.arrayBuffer ? blob.arrayBuffer() : blob)
        .then((ab) => {
          this.result = ab
          if (this.onloadend) this.onloadend()
        })
        .catch((e) => {
          if (this.onerror) this.onerror(e)
        })
    }
    readAsDataURL(blob) {
      Promise.resolve(blob.arrayBuffer ? blob.arrayBuffer() : blob)
        .then((ab) => {
          const b = Buffer.from(ab)
          this.result = 'data:application/octet-stream;base64,' + b.toString('base64')
          if (this.onloadend) this.onloadend()
        })
        .catch((e) => {
          if (this.onerror) this.onerror(e)
        })
    }
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const SUPPORTED_INPUT = new Set(['.stl', '.obj', '.gltf', '.glb', '.3mf'])
const INPUT_FORMAT = {
  '.stl': 'stl',
  '.obj': 'obj',
  '.gltf': 'gltf',
  '.glb': 'glb',
  '.3mf': '3mf',
}

const DEFAULT_OUT_DIR = join(ROOT, 'public', 'models')
const BATCH_INPUT_DIR = join(__dirname, '3d-input')

function getFormat(path) {
  const ext = extname(path).toLowerCase()
  return SUPPORTED_INPUT.has(ext) ? INPUT_FORMAT[ext] : null
}

function outputPath(inputPath, outDir, suffix = '-optimized') {
  const base = basename(inputPath, extname(inputPath))
  return join(outDir, `${base}${suffix}.glb`)
}

async function convertToGlb(inputPath, inputFormat) {
  const { ModelConverter } = await import('@polar3d/model-converter')
  const buffer = readFileSync(inputPath)
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  const result = await ModelConverter.convert(arrayBuffer, inputFormat, 'glb', {
    outputFormat: 'arraybuffer',
  })
  const out = result.arrayBuffer ?? (await result.blob.arrayBuffer())
  return Buffer.from(out)
}

function optimizeGlb(inputGlbPath, outputGlbPath) {
  const args = ['optimize', inputGlbPath, outputGlbPath]
  const r = spawnSync('npx', ['gltf-transform', ...args], { stdio: 'inherit', cwd: ROOT, shell: true })
  if (r.status !== 0) {
    console.error('gltf-transform optimize exited with', r.status)
    process.exit(r.status ?? 1)
  }
}

async function processFile(inputPath, outDir, customOutputName = null) {
  const absPath = resolve(ROOT, inputPath)
  if (!existsSync(absPath)) {
    console.error('Fájl nem található:', absPath)
    return false
  }
  const format = getFormat(absPath)
  if (!format) {
    console.error('Nem támogatott kiterjesztés:', extname(absPath), '– használd: .stl, .obj, .gltf, .glb, .3mf')
    return false
  }
  mkdirSync(outDir, { recursive: true })

  const isGlb = format === 'glb'
  let glbPath = absPath
  if (!isGlb) {
    console.log('Konvertálás:', absPath, '→ GLB')
    const glbBuffer = await convertToGlb(absPath, format)
    glbPath = join(outDir, `${basename(absPath, extname(absPath))}.glb`)
    writeFileSync(glbPath, glbBuffer)
    console.log('  → ideiglenes GLB:', glbPath)
  }

  const finalPath = customOutputName ? join(outDir, customOutputName) : outputPath(glbPath, outDir, isGlb ? '-optimized' : '-optimized')
  console.log('Optimalizálás: gltf-transform optimize →', finalPath)
  const optimizeInput = glbPath
  const optimizeOutput = glbPath === finalPath ? join(outDir, `${basename(glbPath, '.glb')}-tmp.glb`) : finalPath
  optimizeGlb(optimizeInput, optimizeOutput)
  if (optimizeOutput !== finalPath) {
    writeFileSync(finalPath, readFileSync(optimizeOutput))
    try { unlinkSync(optimizeOutput) } catch (_) {}
  }

  if (!isGlb && glbPath !== finalPath) {
    try { unlinkSync(glbPath) } catch (_) {}
  }
  console.log('Kész:', finalPath)
  return true
}

async function batch() {
  if (!existsSync(BATCH_INPUT_DIR)) {
    mkdirSync(BATCH_INPUT_DIR, { recursive: true })
    console.log('Létrehozva:', BATCH_INPUT_DIR)
    console.log('Tegyél bele .stl / .obj / .gltf fájlokat, majd futtasd újra: npm run convert-3d:batch')
    return
  }
  const files = readdirSync(BATCH_INPUT_DIR)
    .map((f) => join(BATCH_INPUT_DIR, f))
    .filter((p) => existsSync(p) && statSync(p).isFile() && getFormat(p))
  if (files.length === 0) {
    console.log('Nincs konvertálandó fájl a', BATCH_INPUT_DIR, 'mappában.')
    return
  }
  console.log('Batch:', files.length, 'fájl →', DEFAULT_OUT_DIR)
  for (const f of files) {
    await processFile(f, DEFAULT_OUT_DIR)
  }
}

/** Webshop: scripts/3d-webshop-paths.json → public/models, egyéni kimeneti nevekkel (UTF-8 útvonalak). */
async function webshop() {
  const configPath = join(__dirname, '3d-webshop-paths.json')
  if (!existsSync(configPath)) {
    console.error('Nincs 3d-webshop-paths.json a scripts mappában.')
    process.exit(1)
  }
  const list = JSON.parse(readFileSync(configPath, 'utf8'))
  if (!Array.isArray(list) || list.length === 0) {
    console.log('Üres vagy érvénytelen 3d-webshop-paths.json')
    return
  }
  console.log('Webshop konverzió:', list.length, 'fájl →', DEFAULT_OUT_DIR)
  for (const { input, output } of list) {
    if (!input || !output) {
      console.error('Minden elemnek kell input és output:', { input, output })
      process.exit(1)
    }
    const ok = await processFile(input, DEFAULT_OUT_DIR, output)
    if (!ok) {
      console.error('Hiányzó vagy érvénytelen input:', input)
      process.exit(1)
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  const batchMode = args.includes('--batch')
  const webshopMode = args.includes('--webshop')
  const outIdx = args.indexOf('--out')
  const outDir = outIdx >= 0 && args[outIdx + 1]
    ? resolve(process.cwd(), args[outIdx + 1])
    : DEFAULT_OUT_DIR
  const inputs = args.filter((a) => !a.startsWith('--') && a !== args[outIdx + 1])

  if (webshopMode) {
    await webshop()
    return
  }
  if (batchMode) {
    await batch()
    return
  }
  if (inputs.length === 0) {
    console.log(`
3D konverzió + optimalizálás (webshop)

Használat:
  npm run convert-3d -- <fájl.stl | fájl.obj | fájl.gltf>
  npm run convert-3d -- model.stl --out public/models
  npm run convert-3d:batch   (scripts/3d-input mappa → public/models)
  npm run convert-3d:webshop (scripts/3d-webshop-paths.json → public/models, egyéni nevekkel)

Támogatott bemenet: .stl, .obj, .gltf, .glb, .3mf
Kimenet: <név>-optimized.glb (gltf-transform optimize)
`)
    process.exit(0)
    return
  }
  for (const input of inputs) {
    await processFile(input, outDir)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
