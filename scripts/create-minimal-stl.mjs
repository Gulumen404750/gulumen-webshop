#!/usr/bin/env node
/**
 * Creates minimal valid binary STL files for pipeline testing.
 * Replace with real STL files and re-run convert-3d:webshop.
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, '3d-source')
mkdirSync(outDir, { recursive: true })

function writeFloatLE(buf, offset, value) {
  buf.writeFloatLE(value, offset)
}

function createMinimalStl() {
  const header = Buffer.alloc(80)
  header.write('minimal stl placeholder', 0)
  const numTriangles = 1
  const triangle = Buffer.alloc(50)
  let off = 0
  writeFloatLE(triangle, off, 0); off += 4
  writeFloatLE(triangle, off, 0); off += 4
  writeFloatLE(triangle, off, 1); off += 4   // normal z=1
  writeFloatLE(triangle, off, 0); off += 4
  writeFloatLE(triangle, off, 0); off += 4
  writeFloatLE(triangle, off, 0); off += 4   // v1
  writeFloatLE(triangle, off, 1); off += 4
  writeFloatLE(triangle, off, 0); off += 4
  writeFloatLE(triangle, off, 0); off += 4   // v2
  writeFloatLE(triangle, off, 0.5); off += 4
  writeFloatLE(triangle, off, 1); off += 4
  writeFloatLE(triangle, off, 0); off += 4   // v3
  triangle.writeUInt16LE(0, 48)
  const countBuf = Buffer.alloc(4)
  countBuf.writeUInt32LE(numTriangles, 0)
  return Buffer.concat([header, countBuf, triangle])
}

const stl = createMinimalStl()
writeFileSync(join(outDir, 'noveny-kotozo.stl'), stl)
writeFileSync(join(outDir, 'szalveta-tarto-korok.stl'), stl)
console.log('Minimal STL placeholder files created in 3d-source/')
console.log('Replace with real STL files and run: npm run convert-3d:webshop')