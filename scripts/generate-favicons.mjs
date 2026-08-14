#!/usr/bin/env node
/**
 * Kör alakú faviconok a public/ mappába (sharp).
 *
 * A Google és a modern böngészők körben jelenítik meg a webhely ikonját.
 * A script a forráslogót a tartalomhoz igazítja, kör maszkot tesz rá
 * (a sarkok átlátszóak), majd a szokásos méreteket kimenti.
 *
 * Használat:
 *   npm run generate-favicons
 *   npm run generate-favicons -- path/to/logo.png
 *
 * Kimenet (public/):
 *   favicon.ico      32×32
 *   favicon-32.png   32×32
 *   icon.png         512×512
 *   apple-icon.png   180×180  (fehér négyzet, kör logó – iOS)
 *
 * A Next.js App Router fájlkonvenció miatt src/app/icon.png és
 * src/app/apple-icon.png is frissül.
 */
import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { dirname, isAbsolute, join, resolve } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(__dirname, '..')

export const OUTPUTS = [
  { name: 'favicon-32.png', size: 32, format: 'png' },
  { name: 'icon.png', size: 512, format: 'png' },
  { name: 'apple-icon.png', size: 180, format: 'apple' },
  { name: 'favicon.ico', size: 32, format: 'ico' },
]

const DEFAULT_SOURCES = [
  'assets/favicon-source.png',
  'public/img/logo-white.png',
  'public/img/logo.png',
]

const MASTER_SIZE = 1024
const CROP_PADDING_RATIO = 0.06

/**
 * Világos papír / fehér háttér (a G és a kék gyűrű nem esik ide).
 */
export function isPaperBackground(r, g, b, a = 255) {
  if (a < 16) return true
  return r > 230 && g > 225 && b > 215 && (r + g + b) / 3 > 232
}

export function contentSquare(info, pixels) {
  const { width, height, channels } = info
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]
      const a = channels >= 4 ? pixels[i + 3] : 255
      if (isPaperBackground(r, g, b, a)) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }

  if (maxX < 0) {
    const size = Math.min(width, height)
    return { left: 0, top: 0, width: size, height: size }
  }

  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const radius = Math.max(cx - minX, maxX - cx, cy - minY, maxY - cy)
  const padded = radius * (1 + CROP_PADDING_RATIO)
  const size = Math.min(width, height, Math.ceil(padded * 2))
  const left = Math.max(0, Math.min(width - size, Math.round(cx - size / 2)))
  const top = Math.max(0, Math.min(height - size, Math.round(cy - size / 2)))
  return { left, top, width: size, height: size }
}

export function circleMaskSvg(size) {
  const c = size / 2
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<circle cx="${c}" cy="${c}" r="${c}" fill="#ffffff"/>` +
      `</svg>`
  )
}

export function pngToIco(png, width = 32, height = 32) {
  const headerSize = 6
  const entrySize = 16
  const offset = headerSize + entrySize
  const buf = Buffer.alloc(offset + png.length)
  buf.writeUInt16LE(0, 0)
  buf.writeUInt16LE(1, 2)
  buf.writeUInt16LE(1, 4)
  buf.writeUInt8(width >= 256 ? 0 : width, 6)
  buf.writeUInt8(height >= 256 ? 0 : height, 7)
  buf.writeUInt8(0, 8)
  buf.writeUInt8(0, 9)
  buf.writeUInt16LE(1, 10)
  buf.writeUInt16LE(32, 12)
  buf.writeUInt32LE(png.length, 14)
  buf.writeUInt32LE(offset, 18)
  png.copy(buf, offset)
  return buf
}

export async function applyCircleMask(pngBuffer, size) {
  const mask = await sharp(circleMaskSvg(size)).png().toBuffer()
  return sharp(pngBuffer)
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

async function circularMaster(sourcePath) {
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const region = contentSquare(info, data)
  const cropped = await sharp(sourcePath)
    .extract(region)
    .resize(MASTER_SIZE, MASTER_SIZE, {
      fit: 'cover',
      position: 'centre',
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .png()
    .toBuffer()

  return applyCircleMask(cropped, MASTER_SIZE)
}

async function resizeCircle(master, size) {
  return sharp(master)
    .resize(size, size, {
      fit: 'contain',
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

/**
 * Az Apple touch icon transzparens sarkait iOS feketére tölti, ezért
 * a kör logót fehér négyzetre tesszük.
 */
async function appleIcon(master, size) {
  const circle = await resizeCircle(master, size)
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: circle, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

export function resolveSourcePath(cliPath, root = ROOT) {
  if (cliPath) {
    const abs = isAbsolute(cliPath) ? cliPath : resolve(process.cwd(), cliPath)
    if (!existsSync(abs)) {
      throw new Error(`Forráskép nem található: ${abs}`)
    }
    return abs
  }
  for (const rel of DEFAULT_SOURCES) {
    const abs = join(root, rel)
    if (existsSync(abs)) return abs
  }
  throw new Error(
    `Nincs forráskép. Add meg a logót: npm run generate-favicons -- path/to/logo.png`
  )
}

export async function generateFavicons({
  sourcePath,
  publicDir,
  appDir,
  syncAppIcons = true,
} = {}) {
  const source = resolveSourcePath(sourcePath)
  const outPublic = publicDir ?? join(ROOT, 'public')
  const outApp = appDir ?? join(ROOT, 'src', 'app')
  mkdirSync(outPublic, { recursive: true })

  const master = await circularMaster(source)
  const written = []

  for (const spec of OUTPUTS) {
    let body
    if (spec.format === 'apple') {
      body = await appleIcon(master, spec.size)
    } else if (spec.format === 'ico') {
      const png = await resizeCircle(master, spec.size)
      body = pngToIco(png, spec.size, spec.size)
    } else {
      body = await resizeCircle(master, spec.size)
    }
    const dest = join(outPublic, spec.name)
    writeFileSync(dest, body)
    written.push(dest)

    if (syncAppIcons && spec.name === 'icon.png') {
      mkdirSync(outApp, { recursive: true })
      const appIcon = join(outApp, 'icon.png')
      writeFileSync(appIcon, body)
      written.push(appIcon)
    }
    if (syncAppIcons && spec.name === 'apple-icon.png') {
      mkdirSync(outApp, { recursive: true })
      const appApple = join(outApp, 'apple-icon.png')
      writeFileSync(appApple, body)
      written.push(appApple)
    }
  }

  return { source, written }
}

async function main() {
  const cliPath = process.argv.slice(2).find((arg) => !arg.startsWith('-'))
  const { source, written } = await generateFavicons({ sourcePath: cliPath })
  console.log(`[generate-favicons] forrás: ${source}`)
  for (const file of written) {
    console.log(`[generate-favicons] írva: ${file}`)
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isDirectRun) {
  main().catch((err) => {
    console.error(`[generate-favicons] ${err.message || err}`)
    process.exit(1)
  })
}
