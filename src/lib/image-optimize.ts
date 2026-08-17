/**
 * Közös kép-pipeline: Sharp WebP + Bunny Storage (vagy lokális fallback).
 * Az admin fájlfeltöltés és a külső URL ingest ugyanide megy.
 */
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import { cleanCdnUrl, getCdnBaseUrl, isBunnyUploadConfigured } from '@/lib/cdn'

export const MAX_IMAGE_INPUT_SIZE = 25 * 1024 * 1024
export const MAX_IMAGE_WIDTH = 2000
export const MAX_IMAGE_HEIGHT = 2000
export const WEBP_QUALITY = 85
export const UPLOAD_DIR = 'public/uploads'

export async function optimizeImageToWebp(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()
}

export async function uploadWebpToBunny(filename: string, body: Buffer): Promise<string> {
  const zone = process.env.BUNNY_STORAGE_ZONE!.trim()
  const apiKey = process.env.BUNNY_STORAGE_API_KEY!.trim()
  const region = (process.env.BUNNY_STORAGE_REGION || '').trim()
  const storageHost = region
    ? `${region.replace(/\.$/, '')}.storage.bunnycdn.com`
    : 'storage.bunnycdn.com'
  const folder = (process.env.BUNNY_STORAGE_PATH || 'products').replace(/^\/+|\/+$/g, '')
  const storagePath = `${folder}/${filename}`
  const putUrl = `https://${storageHost}/${zone}/${storagePath}`

  const res = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      AccessKey: apiKey,
      'Content-Type': 'image/webp',
    },
    body: new Uint8Array(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Bunny feltöltés sikertelen (${res.status}): ${text || res.statusText}`)
  }

  return cleanCdnUrl(`${getCdnBaseUrl()}/${storagePath}`)
}

export async function persistOptimizedWebp(
  filename: string,
  body: Buffer,
  options: { allowLocalFallback?: boolean } = {}
): Promise<{ url: string; storage: 'bunny' | 'local' }> {
  if (isBunnyUploadConfigured()) {
    const url = await uploadWebpToBunny(filename, body)
    return { url, storage: 'bunny' }
  }

  const allowLocal = options.allowLocalFallback ?? process.env.NODE_ENV !== 'production'
  if (!allowLocal) {
    throw new Error(
      'A külső kép CDN-re mentéséhez a Bunny Storage nincs beállítva (BUNNY_STORAGE_ZONE / BUNNY_STORAGE_API_KEY).'
    )
  }

  const dir = path.join(process.cwd(), UPLOAD_DIR)
  const filepath = path.join(dir, filename)
  await mkdir(dir, { recursive: true })
  await writeFile(filepath, body)
  return { url: cleanCdnUrl(`/uploads/${filename}`), storage: 'local' }
}
