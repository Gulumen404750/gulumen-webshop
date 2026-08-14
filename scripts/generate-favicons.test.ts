import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import sharp from 'sharp'
import {
  applyCircleMask,
  contentSquare,
  generateFavicons,
  isPaperBackground,
  pngToIco,
} from './generate-favicons.mjs'

const temps: string[] = []

afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('isPaperBackground', () => {
  it('treats white and cream as background', () => {
    expect(isPaperBackground(255, 255, 255)).toBe(true)
    expect(isPaperBackground(245, 242, 238)).toBe(true)
  })

  it('keeps the black G and blue ring', () => {
    expect(isPaperBackground(0, 0, 0)).toBe(false)
    expect(isPaperBackground(30, 136, 229)).toBe(false)
  })
})

describe('contentSquare', () => {
  it('crops to a square around non-paper pixels', () => {
    const width = 10
    const height = 10
    const channels = 4
    const pixels = Buffer.alloc(width * height * channels, 255)
    // 4×4 black block at (3,3)..(6,6)
    for (let y = 3; y <= 6; y++) {
      for (let x = 3; x <= 6; x++) {
        const i = (y * width + x) * channels
        pixels[i] = 0
        pixels[i + 1] = 0
        pixels[i + 2] = 0
        pixels[i + 3] = 255
      }
    }
    const region = contentSquare({ width, height, channels }, pixels)
    expect(region.width).toBe(region.height)
    expect(region.left + region.width).toBeLessThanOrEqual(width)
    expect(region.top + region.height).toBeLessThanOrEqual(height)
    expect(region.left).toBeLessThanOrEqual(3)
    expect(region.top).toBeLessThanOrEqual(3)
    expect(region.left + region.width).toBeGreaterThan(6)
    expect(region.top + region.height).toBeGreaterThan(6)
  })
})

describe('pngToIco', () => {
  it('writes a single-image ICO header around a PNG payload', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const ico = pngToIco(png, 32, 32)
    expect(ico.readUInt16LE(0)).toBe(0)
    expect(ico.readUInt16LE(2)).toBe(1)
    expect(ico.readUInt16LE(4)).toBe(1)
    expect(ico.readUInt8(6)).toBe(32)
    expect(ico.readUInt8(7)).toBe(32)
    expect(ico.readUInt32LE(14)).toBe(png.length)
    expect(ico.readUInt32LE(18)).toBe(22)
    expect(ico.subarray(22).equals(png)).toBe(true)
  })
})

describe('generateFavicons', () => {
  it('writes circular 32/180/512 icons into public/', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'favicons-'))
    temps.push(dir)
    const sourcePath = join(dir, 'logo.png')
    const publicDir = join(dir, 'public')
    const appDir = join(dir, 'app')

    // White square with a centered opaque blue circle (the "logo").
    const size = 200
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
        `<rect width="${size}" height="${size}" fill="#ffffff"/>` +
        `<circle cx="100" cy="100" r="70" fill="#1e88e5"/>` +
        `</svg>`
    )
    await sharp(svg).png().toFile(sourcePath)

    const { written } = await generateFavicons({ sourcePath, publicDir, appDir })
    expect(written.some((p) => p.endsWith('favicon-32.png'))).toBe(true)

    const icon32 = await sharp(join(publicDir, 'favicon-32.png')).metadata()
    const icon512 = await sharp(join(publicDir, 'icon.png')).metadata()
    const apple = await sharp(join(publicDir, 'apple-icon.png')).metadata()
    expect(icon32.width).toBe(32)
    expect(icon32.height).toBe(32)
    expect(icon32.hasAlpha).toBe(true)
    expect(icon512.width).toBe(512)
    expect(apple.width).toBe(180)

    const ico = await readFile(join(publicDir, 'favicon.ico'))
    expect(ico.readUInt16LE(2)).toBe(1)
    expect(ico.readUInt8(6)).toBe(32)

    const { data, info } = await sharp(join(publicDir, 'icon.png'))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const corner = 0
    expect(data[corner + 3]).toBeLessThan(16)

    const mid = ((Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) *
      info.channels)
    expect(data[mid + 3]).toBeGreaterThan(200)

    const appIcon = await sharp(join(appDir, 'icon.png')).metadata()
    expect(appIcon.width).toBe(512)
  })
})

describe('applyCircleMask', () => {
  it('clears pixels outside the inscribed circle', async () => {
    const square = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 255 },
      },
    })
      .png()
      .toBuffer()
    const masked = await applyCircleMask(square, 64)
    const { data, info } = await sharp(masked).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    })
    expect(data[3]).toBeLessThan(16)
    const center =
      (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels
    expect(data[center + 3]).toBe(255)
  })
})
